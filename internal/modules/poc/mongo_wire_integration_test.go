package poc

import (
	"context"
	"net"
	"os"
	"strconv"
	"testing"
	"time"
)

func mongoTargetFromAddress(t *testing.T, address string) Target {
	t.Helper()
	host, portRaw, err := net.SplitHostPort(address)
	if err != nil {
		t.Fatal(err)
	}
	port, err := strconv.Atoi(portRaw)
	if err != nil {
		t.Fatal(err)
	}
	return Target{Host: host, Port: port, Scheme: "mongodb"}
}

func TestMongoPluginsUseWireClient(t *testing.T) {
	noauth := os.Getenv("T4C_TEST_MONGO_NOAUTH_ADDR")
	auth := os.Getenv("T4C_TEST_MONGO_AUTH_ADDR")
	if noauth == "" || auth == "" {
		t.Skip("set T4C_TEST_MONGO_NOAUTH_ADDR and T4C_TEST_MONGO_AUTH_ADDR to run MongoDB plugin integration tests")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	plugin := &MongoNoAuthPlugin{MetaData: Meta{Name: "Mongodb_noauth", DefaultPorts: []int{27017}, Schemes: []string{"mongodb"}}}
	result, err := plugin.Run(ctx, mongoTargetFromAddress(t, noauth))
	if err != nil || !result.Hit {
		t.Fatalf("noauth result=%+v err=%v", result, err)
	}
	authTarget := mongoTargetFromAddress(t, auth)
	ok, err := mongoLogin(ctx, authTarget, os.Getenv("T4C_TEST_MONGO_USER"), os.Getenv("T4C_TEST_MONGO_PASSWORD"))
	if err != nil || !ok {
		t.Fatalf("valid mongo login ok=%v err=%v", ok, err)
	}
	ok, err = mongoLogin(ctx, authTarget, os.Getenv("T4C_TEST_MONGO_USER"), "wrong-password")
	if err != nil || ok {
		t.Fatalf("invalid mongo login ok=%v err=%v", ok, err)
	}
}
