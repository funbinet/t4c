package poc

import (
	"context"
	"fmt"
	"strings"
)

type HTTPCheck struct {
	Path         string
	Method       string
	Body         string
	Status       []int
	ContainsBody []string
	ContainsHead []string
	Headers      map[string]string
}

type HTTPPlugin struct {
	MetaData Meta
	Checks   []HTTPCheck
	Client   *HTTPClient
}

func (p *HTTPPlugin) Meta() Meta { return p.MetaData }

func (p *HTTPPlugin) Run(ctx context.Context, target Target) (Result, error) {
	base := target.URL
	if !strings.Contains(base, "://") {
		base = target.Scheme + "://" + target.Host
		if target.Port > 0 && target.Port != 80 && target.Port != 443 {
			base += fmt.Sprintf(":%d", target.Port)
		}
	}
	for _, check := range p.Checks {
		method := check.Method
		if method == "" {
			method = "GET"
		}
		u := JoinURL(base, check.Path)
		start := ctx
		resp, err := p.Client.Do(start, method, u, check.Body, check.Headers)
		if err != nil {
			continue
		}
		if len(check.Status) > 0 && !containsInt(check.Status, resp.Status) {
			continue
		}
		if len(check.ContainsBody) > 0 && !containsAny(resp.Body, check.ContainsBody) {
			continue
		}
		if len(check.ContainsHead) > 0 && !containsHeader(resp.Header, check.ContainsHead) {
			continue
		}
		body := resp.Body
		if len(body) > 4000 {
			body = body[:4000]
		}
		return Result{Hit: true, Target: u, VerifyData: u, Data: map[string]any{
			"url": u, "status": resp.Status, "body": body,
			"contentType": resp.Header.Get("Content-Type"),
		}}, nil
	}
	return Result{}, nil
}

func containsInt(values []int, v int) bool {
	for _, x := range values {
		if x == v {
			return true
		}
	}
	return false
}

func containsAny(body string, needles []string) bool {
	for _, n := range needles {
		if strings.Contains(body, n) {
			return true
		}
	}
	return false
}

func containsHeader(h map[string][]string, needles []string) bool {
	var all strings.Builder
	for k, v := range h {
		all.WriteString(k)
		all.WriteString(": ")
		all.WriteString(strings.Join(v, ","))
		all.WriteString("\n")
	}
	text := all.String()
	for _, n := range needles {
		if strings.Contains(text, n) {
			return true
		}
	}
	return false
}

func BuiltinHTTPPlugins(client *HTTPClient) []Plugin {
	type def struct {
		name  string
		typ   PluginType
		app   string
		vul   string
		cat   string
		check []HTTPCheck
	}
	defs := []def{
		{"Actuator_noauth", TypePOC, "Spring Boot Actuator", "Actuator unauthorized access", "Unauthorized access", []HTTPCheck{{Path: "/actuator/env", ContainsBody: []string{"propertySources", "activeProfiles"}}, {Path: "/env", ContainsBody: []string{"propertySources"}}}},
		{"Actuator_httptrace_noauth", TypePOC, "Spring Boot Actuator", "Actuator httptrace unauthorized access", "Unauthorized access", []HTTPCheck{{Path: "/actuator/httptrace", ContainsBody: []string{"traces"}}, {Path: "/httptrace", ContainsBody: []string{"traces"}}}},
		{"Actuator_noauth_bypass_waf", TypePOC, "Spring Boot Actuator", "Actuator WAF bypass unauthorized access", "Unauthorized access", []HTTPCheck{{Path: "/actuator/env;", ContainsBody: []string{"propertySources"}}, {Path: "/actuator/env/", ContainsBody: []string{"propertySources"}}}},
		{"Apollo_Adminservice_noauth", TypePOC, "Apollo", "Apollo AdminService unauthorized", "Unauthorized access", []HTTPCheck{{Path: "/services/admin", ContainsBody: []string{"apollo"}}, {Path: "/services/config", ContainsBody: []string{"apollo"}}}},
		{"DockerRemoteAPI_noauth", TypePOC, "Docker", "Docker Remote API unauthorized", "Unauthorized access", []HTTPCheck{{Path: "/version", ContainsBody: []string{"ApiVersion", "Version"}}, {Path: "/info", ContainsBody: []string{"Containers", "Images"}}}},
		{"Druid_noauth", TypePOC, "Druid", "Druid monitoring page unauthorized access", "Unauthorized access", []HTTPCheck{{Path: "/druid/index.html", ContainsBody: []string{"Druid"}}, {Path: "/druid/websession.html", ContainsBody: []string{"Druid"}}}},
		{"Elasticsearch_noauth", TypePOC, "Elasticsearch", "Elasticsearch unauthorized access", "Unauthorized access", []HTTPCheck{{Path: "/", ContainsBody: []string{"cluster_name", "lucene_version"}}, {Path: "/_cluster/health", ContainsBody: []string{"cluster_name"}}}},
		{"Hadoop_YARN_RPC_noauth", TypePOC, "Hadoop YARN", "Hadoop YARN unauthorized", "Unauthorized access", []HTTPCheck{{Path: "/ws/v1/cluster/info", ContainsBody: []string{"clusterInfo", "hadoop"}}}},
		{"Headless_remote_API_noauth", TypePOC, "Headless Chrome", "Headless Remote API unauthorized", "Unauthorized access", []HTTPCheck{{Path: "/json/version", ContainsBody: []string{"webSocketDebuggerUrl", "Browser"}}, {Path: "/json", ContainsBody: []string{"webSocketDebuggerUrl"}}}},
		{"Kibana_noauth", TypePOC, "Kibana", "Kibana unauthorized access", "Unauthorized access", []HTTPCheck{{Path: "/app/kibana", ContainsBody: []string{"kibana", "Kibana"}}, {Path: "/api/status", ContainsBody: []string{"kibana"}}}},
		{"Nacos_noauth", TypePOC, "Nacos", "Nacos unauthorized access", "Unauthorized access", []HTTPCheck{{Path: "/nacos/v1/console/server/state", ContainsBody: []string{"version", "auth_enabled"}}, {Path: "/nacos/", ContainsBody: []string{"Nacos"}}}},
		{"Onlyoffice_noauth", TypePOC, "OnlyOffice", "OnlyOffice unauthorized access", "Unauthorized access", []HTTPCheck{{Path: "/web-apps/apps/api/documents/api.js", ContainsBody: []string{"DocsAPI"}}}},
		{"Solr_noauth", TypePOC, "Solr", "Solr unauthorized access", "Unauthorized access", []HTTPCheck{{Path: "/solr/", ContainsBody: []string{"Solr"}}, {Path: "/solr/admin/cores", ContainsBody: []string{"responseHeader"}}}},
		{"Ueditor_SSRF", TypePOC, "Ueditor", "Ueditor SSRF", "SSRF", []HTTPCheck{{Path: "/ueditor/php/controller.php?action=catchimage&source%5b%5d=http://127.0.0.1:1/x.png", ContainsBody: []string{"链接不可用", "请求地址出错"}}}},
		{"Ueditor_Store_XSS", TypePOC, "Ueditor", "Ueditor stored XSS", "XSS", []HTTPCheck{{Path: "/ueditor/php/controller.php?action=config", ContainsBody: []string{"imageUrlPrefix", "imageMaxSize"}}}},
		{"Gitlab_Username_Leak", TypePOC, "GitLab", "GitLab username leak", "information disclosure", []HTTPCheck{{Path: "/users?username=root", ContainsBody: []string{"username", "id"}}}},
		{"Django_Debug_Info", TypePOC, "Django", "Django DEBUG information disclosure", "information disclosure", []HTTPCheck{{Path: "/__debug__/", ContainsBody: []string{"Django", "debug"}}, {Path: "/", ContainsBody: []string{"DisallowedHost", "DEBUG = True"}}}},
		{"WEB_INF_WEB_xml_leak", TypePOC, "Java Web", "WEB-INF/web.xml disclosure", "information disclosure", []HTTPCheck{{Path: "/WEB-INF/web.xml", Status: []int{200}, ContainsBody: []string{"<web-app"}}}},
		{"Adminer_PHP_Identify", TypePOC, "Adminer", "Adminer detected", "Application detection", []HTTPCheck{{Path: "/adminer.php", ContainsBody: []string{"Adminer"}}}},
		{"Any800_Identify", TypePOC, "Any800", "Any800 detected", "Application detection", []HTTPCheck{{Path: "/Any800/", ContainsBody: []string{"Any800"}}}},
		{"Apache_Apereo_CAS_Identify", TypePOC, "Apereo CAS", "Apereo CAS detected", "Application detection", []HTTPCheck{{Path: "/cas/login", ContainsBody: []string{"CAS", "cas"}}}},
		{"Apache_Ofbiz_Identify", TypePOC, "Apache OFBiz", "Apache OFBiz detected", "Application detection", []HTTPCheck{{Path: "/webtools/control/main", ContainsBody: []string{"OFBiz", "ofbiz"}}}},
		{"Clickhouse_REST_API_Identify", TypePOC, "ClickHouse", "ClickHouse REST API detected", "Application detection", []HTTPCheck{{Path: "/ping", ContainsBody: []string{"Ok."}}}},
		{"Finereport_Identify", TypePOC, "FineReport", "FineReport detected", "Application detection", []HTTPCheck{{Path: "/WebReport/ReportServer", ContainsBody: []string{"FineReport", "fr"}}}},
		{"FinereportV10_Identify", TypePOC, "FineReport", "FineReport V10 detected", "Application detection", []HTTPCheck{{Path: "/webroot/decision/login", ContainsBody: []string{"FineReport", "decision"}}}},
		{"Grafana_Identify", TypePOC, "Grafana", "Grafana detected", "Application detection", []HTTPCheck{{Path: "/login", ContainsBody: []string{"Grafana"}}}},
		{"Graphql_Identify", TypePOC, "GraphQL", "GraphQL detected", "Application detection", []HTTPCheck{{Path: "/graphql", ContainsBody: []string{"graphql", "GraphQL"}}, {Path: "/graphiql", ContainsBody: []string{"GraphiQL"}}}},
		{"Harbor_Identify", TypePOC, "Harbor", "Harbor detected", "Application detection", []HTTPCheck{{Path: "/api/v2.0/systeminfo", ContainsBody: []string{"harbor_version", "registry_url"}}}},
		{"Hystrix_Dashboard_Identify", TypePOC, "Hystrix", "Hystrix Dashboard detected", "Application detection", []HTTPCheck{{Path: "/hystrix", ContainsBody: []string{"Hystrix Dashboard"}}, {Path: "/hystrix-dashboard/", ContainsBody: []string{"Hystrix"}}}},
		{"Nacos_Identify", TypePOC, "Nacos", "Nacos detected", "Application detection", []HTTPCheck{{Path: "/nacos/", ContainsBody: []string{"Nacos"}}}},
		{"Oracle_Weblogic_Console_Identify", TypePOC, "WebLogic", "WebLogic Console detected", "Application detection", []HTTPCheck{{Path: "/console/login/LoginForm.jsp", ContainsBody: []string{"WebLogic", "weblogic"}}}},
		{"Shiro_Identify", TypePOC, "Shiro", "Shiro detected", "Application detection", []HTTPCheck{{Path: "/", ContainsHead: []string{"rememberMe=deleteMe"}}}},
		{"Swagger_Json_Identify", TypePOC, "Swagger", "Swagger documentation detected", "Application detection", []HTTPCheck{{Path: "/swagger-ui.html", ContainsBody: []string{"swagger"}}, {Path: "/v2/api-docs", ContainsBody: []string{"swagger", "paths"}}, {Path: "/openapi.json", ContainsBody: []string{"openapi", "paths"}}}},
		{"Weaver_Ecology_Identify", TypePOC, "Weaver", "Weaver Ecology detected", "Application detection", []HTTPCheck{{Path: "/wui/index.html", ContainsBody: []string{"泛微", "weaver", "ecology"}}}},
		{"XXL_Job_Admin_Identify", TypePOC, "XXL-JOB", "XXL-JOB detected", "Application detection", []HTTPCheck{{Path: "/xxl-job-admin/toLogin", ContainsBody: []string{"XXL-JOB", "xxl-job"}}}},
		{"vcenter_identify", TypePOC, "vCenter", "vCenter detected", "Application detection", []HTTPCheck{{Path: "/sdk", ContainsBody: []string{"vCenter", "VMware"}}, {Path: "/ui/", ContainsBody: []string{"vSphere"}}}},
	}
	var out []Plugin
	for _, d := range defs {
		meta := Meta{Name: d.name, Type: d.typ, AppName: d.app, VulName: d.vul, Category: d.cat, Schemes: []string{"http", "https"}}
		out = append(out, &HTTPPlugin{MetaData: meta, Checks: d.check, Client: client})
	}
	return out
}
