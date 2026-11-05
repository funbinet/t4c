package store

import (
	"context"
	"fmt"
	"time"

	"github.com/funbinet/t4c/internal/domain"
	"gorm.io/gorm"
)

func DefaultPolicy() domain.Policy {
	return domain.Policy{
		Name:        "Default policy",
		Description: "System default asset discovery policy",
		Category:    domain.PolicyCategoryAttackSurface,
		Config: domain.PolicyConfig{
			Domain: domain.DomainPolicy{DomainBrute: false, DomainBruteType: "test", AltDNS: false, T4CSearch: true, DNSQueryPlugin: true},
			IP: domain.IPPolicy{
				PortScan: true, PortScanType: "top1000", ServiceDetection: false, OSDetection: false,
				SSLCert: false, SkipScanCDNIP: true, HostTimeout: 900, PortParallelism: 32, PortMinRate: 60,
			},
			Site: domain.SitePolicy{SiteIdentify: true, SiteCapture: false, SearchEngines: false, SiteSpider: false, NucleiScan: false, WebInfoHunter: false},
		},
	}
}

// ModulePolicyTemplates returns example policies for each non-default module so the
// framework can be extended beyond pure attack-surface mapping.
func ModulePolicyTemplates() []domain.Policy {
	return []domain.Policy{
		{
			Name:        "Vulnerability Assessment",
			Description: "Deep vulnerability assessment of discovered assets using nuclei and PoC plugins.",
			Category:    domain.PolicyCategoryVulnAssessment,
			Config: domain.PolicyConfig{
				Domain: domain.DomainPolicy{T4CSearch: true, DNSQueryPlugin: true},
				IP:     domain.IPPolicy{PortScan: true, PortScanType: "top1000", ServiceDetection: true, SSLCert: true, HostTimeout: 900},
				Site:   domain.SitePolicy{SiteIdentify: true, NucleiScan: true, WebInfoHunter: true, FileLeak: true},
			},
		},
		{
			Name:        "Active Probing",
			Description: "Aggressive service and protocol probing for hidden assets and vhosts.",
			Category:    domain.PolicyCategoryProbing,
			Config: domain.PolicyConfig{
				Domain: domain.DomainPolicy{DomainBrute: true, DomainBruteType: "test", AltDNS: true, T4CSearch: true, DNSQueryPlugin: true},
				IP:     domain.IPPolicy{PortScan: true, PortScanType: "all", ServiceDetection: true, OSDetection: true, SSLCert: true, HostTimeout: 1200, PortParallelism: 64, PortMinRate: 120},
				Site:   domain.SitePolicy{SiteIdentify: true, SiteCapture: true, SiteSpider: true, FindVhost: true, SearchEngines: true},
			},
		},
		{
			Name:        "Controlled Exploitation",
			Description: "Validates findings with controlled exploitation. Run only with explicit authorization.",
			Category:    domain.PolicyCategoryExploitation,
			Config: domain.PolicyConfig{
				Domain: domain.DomainPolicy{T4CSearch: true, DNSQueryPlugin: true},
				IP:     domain.IPPolicy{PortScan: true, PortScanType: "top1000", ServiceDetection: true, SSLCert: true, HostTimeout: 900},
				Site:   domain.SitePolicy{SiteIdentify: true, NucleiScan: true, WebInfoHunter: true, FileLeak: true},
			},
		},
	}
}

func (s *Store) SeedDefaultPolicy(ctx context.Context) error {
	var n int64
	if err := s.db.WithContext(ctx).Model(&domain.Policy{}).Count(&n).Error; err != nil || n > 0 {
		return err
	}
	now := time.Now().UTC()
	p := DefaultPolicy()
	p.CreatedAt, p.UpdatedAt, p.SchemaVersion = now, now, domain.SchemaVersion
	if err := s.db.WithContext(ctx).Create(&p).Error; err != nil && !isDuplicate(err) {
		return err
	}
	for _, t := range ModulePolicyTemplates() {
		var exists int64
		if err := s.db.WithContext(ctx).Model(&domain.Policy{}).Where("name = ?", t.Name).Count(&exists).Error; err != nil {
			return err
		}
		if exists > 0 {
			continue
		}
		t.CreatedAt, t.UpdatedAt, t.SchemaVersion = now, now, domain.SchemaVersion
		if err := s.db.WithContext(ctx).Create(&t).Error; err != nil && !isDuplicate(err) {
			return err
		}
	}
	return nil
}

func (s *Store) CreatePolicy(ctx context.Context, p *domain.Policy) error {
	now := time.Now().UTC()
	p.CreatedAt, p.UpdatedAt, p.SchemaVersion = now, now, domain.SchemaVersion
	p.Category = domain.NormalizePolicyCategory(p.Category)
	if p.ID == "" {
		id, err := domain.NewID()
		if err != nil {
			return err
		}
		p.ID = id
	}
	return s.db.WithContext(ctx).Create(p).Error
}

// ListPoliciesByCategory returns policies, optionally filtered to a single category.
func (s *Store) ListPoliciesByCategory(ctx context.Context, category string) ([]domain.Policy, error) {
	var out []domain.Policy
	q := active(s.db.WithContext(ctx)).Order("created_at ASC, id ASC")
	if category != "" {
		q = q.Where("category = ?", domain.NormalizePolicyCategory(category))
	}
	err := q.Find(&out).Error
	return out, err
}

func (s *Store) GetPolicy(ctx context.Context, id string) (*domain.Policy, error) {
	var p domain.Policy
	err := active(s.db.WithContext(ctx)).Where("id = ?", id).First(&p).Error
	if isNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *Store) ListPolicies(ctx context.Context) ([]domain.Policy, error) {
	var out []domain.Policy
	err := active(s.db.WithContext(ctx)).Order("created_at ASC, id ASC").Find(&out).Error
	return out, err
}

func (s *Store) UpdatePolicy(ctx context.Context, p *domain.Policy) error {
	p.UpdatedAt = time.Now().UTC()
	p.Category = domain.NormalizePolicyCategory(p.Category)
	return activeUpdateResult(s.db.WithContext(ctx).Model(&domain.Policy{}).
		Where("id = ? AND deleted_at IS NULL", p.ID).
		Updates(map[string]any{
			"name": p.Name, "description": p.Description, "category": p.Category,
			"config": jsonbExpr(p.Config), "updated_at": p.UpdatedAt,
		}))
}

func (s *Store) DeletePolicy(ctx context.Context, id, actor string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := active(tx).Where("id = ?", id).First(&domain.Policy{}).Error; err != nil {
			if isNotFound(err) {
				return domain.ErrRecordNotFound
			}
			return err
		}
		var monitors, schedules int64
		if err := active(tx).Model(&domain.Monitor{}).Where("policy_id = ?", id).Count(&monitors).Error; err != nil {
			return err
		}
		if err := active(tx).Model(&domain.Schedule{}).
			Where("policy_id = ? AND status <> ?", id, "completed").
			Count(&schedules).Error; err != nil {
			return err
		}
		if monitors+schedules > 0 {
			return fmt.Errorf("%w: %d monitor(s), %d schedule(s)", domain.ErrResourceInUse, monitors, schedules)
		}
		return softDeleteRecordTx(tx, "policy", id, actor)
	})
}
