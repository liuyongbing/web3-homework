package config

type Config struct {
	JWT      JWT      `mapstructure:"jwt"`
	Database Database `mapstructure:"database"`
	Server   Server   `mapstructure:"server"`
	Log      Log      `mapstructure:"log"`
}

type JWT struct {
	Secret string `mapstructure:"secret"`
	Expire string `mapstructure:"expire"`
}

type Database struct {
	Driver   string `mapstructure:"driver"` // mysql | sqlite | postgres
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	DBName   string `mapstructure:"dbname"`
	Username string `mapstructure:"username"`
	Password string `mapstructure:"password"`
}

type Server struct {
	Port int    `mapstructure:"port"`
	Mode string `mapstructure:"mode"` // debug | release | test
}

type Log struct {
	Filename   string `mapstructure:"filename"`
	MaxSize    int    `mapstructure:"maxsize"` // MB
	MaxBackups int    `mapstructure:"maxbackups"`
	MaxAge     int    `mapstructure:"maxage"` // days
	Compress   bool   `mapstructure:"compress"`
}
