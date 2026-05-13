package dao

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"nadaona.com/web3-homework/blog/models"
)

func TestPostDao_Create(t *testing.T) {
	d := NewPostDao(setupTestDB(t))

	post := models.Post{Title: "Test", Content: "Content", UserID: 1}
	assert.NoError(t, d.Create(&post))
	assert.NotZero(t, post.ID)
}

func TestPostDao_FindByID(t *testing.T) {
	d := NewPostDao(setupTestDB(t))
	d.Create(&models.Post{Title: "Test", Content: "Content", UserID: 1})

	post, err := d.FindByID("1")
	assert.NoError(t, err)
	assert.Equal(t, "Test", post.Title)

	_, err = d.FindByID("999")
	assert.Error(t, err)
}

func TestPostDao_FindList(t *testing.T) {
	d := NewPostDao(setupTestDB(t))
	for range 5 {
		d.Create(&models.Post{Title: "Post", Content: "C", UserID: 1})
	}

	posts, err := d.FindList(0, 3)
	assert.NoError(t, err)
	assert.Len(t, posts, 3)

	posts2, err := d.FindList(3, 3)
	assert.NoError(t, err)
	assert.Len(t, posts2, 2)
}

func TestPostDao_Update(t *testing.T) {
	d := NewPostDao(setupTestDB(t))
	d.Create(&models.Post{Title: "Old", Content: "Old", UserID: 1})

	post, _ := d.FindByID("1")
	post.Title = "New"
	assert.NoError(t, d.Update(post))

	updated, _ := d.FindByID("1")
	assert.Equal(t, "New", updated.Title)
}

func TestPostDao_DeleteByIDAndUserID(t *testing.T) {
	d := NewPostDao(setupTestDB(t))
	d.Create(&models.Post{Title: "Test", Content: "C", UserID: 1})

	rows, err := d.DeleteByIDAndUserID("1", 1)
	assert.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	rows, err = d.DeleteByIDAndUserID("1", 2)
	assert.NoError(t, err)
	assert.Equal(t, int64(0), rows)
}
