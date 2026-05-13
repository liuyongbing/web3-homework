package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"nadaona.com/web3-homework/blog/dao"
	"nadaona.com/web3-homework/blog/initialize"
	"nadaona.com/web3-homework/blog/middlewares"
	"nadaona.com/web3-homework/blog/routes"
)

func main() {
	initialize.LoadConfig()
	initialize.InitLogger()

	switch initialize.Config.Server.Mode {
	case gin.ReleaseMode:
		gin.SetMode(gin.ReleaseMode)
	case gin.TestMode:
		gin.SetMode(gin.TestMode)
	default:
		gin.SetMode(gin.DebugMode)
	}

	db := initialize.DB()
	repos := dao.NewRepos(db)
	expire, err := time.ParseDuration(initialize.Config.JWT.Expire)
	if err != nil {
		slog.Error("invalid jwt expire format", "value", initialize.Config.JWT.Expire, "error", err)
		os.Exit(1)
	}
	auth := middlewares.NewAuth(initialize.Config.JWT.Secret, expire)

	r := gin.Default()
	routes.Register(r, repos, auth)

	port := fmt.Sprintf(":%d", initialize.Config.Server.Port)
	srv := &http.Server{Addr: port, Handler: r}

	go func() {
		slog.Info("server starting", "port", port, "mode", initialize.Config.Server.Mode)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server listen failed", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	slog.Info("shutting down", "signal", sig)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("server shutdown failed", "error", err)
		os.Exit(1)
	}
	slog.Info("server exited")
}
