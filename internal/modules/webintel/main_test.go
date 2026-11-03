package webintel

import (
	"io"
	"log/slog"
	"os"
	"testing"

	"github.com/funbinet/t4c/internal/platform/pdtools"
)

func TestMain(m *testing.M) {
	pdtools.ConfigureLogging(slog.New(slog.NewTextHandler(io.Discard, nil)), false)
	os.Exit(m.Run())
}
