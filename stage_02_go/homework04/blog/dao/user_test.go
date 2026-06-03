package dao

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"nadaona.com/web3-homework/blog/models"
)

func TestUserDao_Create(t *testing.T) {
	d := NewUserDao(setupTestDB(t))

	user := models.User{Username: "test", Password: "hashed", Email: "test@example.com"}
	assert.NoError(t, d.Create(&user))
	assert.NotZero(t, user.ID)
}

func TestUserDao_FindByUsername(t *testing.T) {
	d := NewUserDao(setupTestDB(t))
	d.Create(&models.User{Username: "test", Password: "hashed", Email: "test@example.com"})

	user, err := d.FindByUsername("test")
	assert.NoError(t, err)
	assert.Equal(t, "test", user.Username)

	_, err = d.FindByUsername("notexist")
	assert.Error(t, err)
}
