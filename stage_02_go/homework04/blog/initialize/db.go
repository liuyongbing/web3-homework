package initialize

import (
	"fmt"

	"github.com/spf13/viper"
	"gorm.io/driver/mysql"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"nadaona.com/web3-homework/blog/config"
)

var Config config.Config

func LoadConfig() {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath("config")
	viper.AddConfigPath(".")
	viper.AddConfigPath("../../config")

	if err := viper.ReadInConfig(); err != nil {
		panic(err)
	}

	if err := viper.Unmarshal(&Config); err != nil {
		panic(err)
	}
}

func DB() *gorm.DB {
	var dialector gorm.Dialector

	switch Config.Database.Driver {
	case "sqlite":
		dialector = sqlite.Open(Config.Database.DBName)
	default:
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
			Config.Database.Username,
			Config.Database.Password,
			Config.Database.Host,
			Config.Database.Port,
			Config.Database.DBName,
		)
		dialector = mysql.Open(dsn)
	}

	db, err := gorm.Open(dialector, &gorm.Config{})
	if err != nil {
		panic(err)
	}

	return db
}
