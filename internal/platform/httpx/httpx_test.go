package httpx

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type optionalBody struct {
	FromStage string `json:"fromStage"`
}

func TestDecodeOptionalJSON(t *testing.T) {
	cases := []struct {
		name      string
		body      string
		wantOK    bool
		wantValue string
		wantCode  int
	}{
		{"empty body accepted", "", true, "", 0},
		{"valid body decoded", `{"fromStage":"recon"}`, true, "recon", 0},
		{"empty object accepted", `{}`, true, "", 0},
		{"unknown field rejected", `{"unexpected":1}`, false, "", http.StatusBadRequest},
		{"trailing data rejected", `{} {}`, false, "", http.StatusBadRequest},
		{"malformed json rejected", `{"fromStage":`, false, "", http.StatusBadRequest},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/advance", strings.NewReader(tc.body))
			rec := httptest.NewRecorder()
			var got optionalBody
			ok := DecodeOptionalJSON(rec, req, &got)
			if ok != tc.wantOK {
				t.Fatalf("ok = %v, want %v (body=%s)", ok, tc.wantOK, rec.Body.String())
			}
			if got.FromStage != tc.wantValue {
				t.Fatalf("fromStage = %q, want %q", got.FromStage, tc.wantValue)
			}
			if tc.wantCode != 0 && rec.Code != tc.wantCode {
				t.Fatalf("status = %d, want %d", rec.Code, tc.wantCode)
			}
		})
	}
}
