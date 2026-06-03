package initialize

import (
	"log/slog"
	"os"
	"path/filepath"

	"gopkg.in/natefinch/lumberjack.v2"
)

func InitLogger() {
	mode := Config.Server.Mode
	var handler slog.Handler

	if mode == "release" || mode == "test" {
		logCfg := Config.Log
		logDir := filepath.Dir(logCfg.Filename)
		if err := os.MkdirAll(logDir, 0755); err != nil {
			slog.Error("failed to create log directory", "error", err)
			os.Exit(1)
		}

		writer := &lumberjack.Logger{
			Filename:   logCfg.Filename,
			MaxSize:    logCfg.MaxSize,
			MaxBackups: logCfg.MaxBackups,
			MaxAge:     logCfg.MaxAge,
			Compress:   logCfg.Compress,
		}
		handler = slog.NewJSONHandler(writer, nil)
	} else {
		handler = slog.NewJSONHandler(os.Stdout, nil)
	}

	logger := slog.New(handler)
	slog.SetDefault(logger)
	slog.Info("logger initialized", "mode", mode)
}
