package dao

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"nadaona.com/web3-homework/blog/models"
)

func TestCommentDao_Create(t *testing.T) {
	d := NewCommentDao(setupTestDB(t))

	comment := models.Comment{Content: "Nice", UserID: 1, PostID: 1}
	assert.NoError(t, d.Create(&comment))
	assert.NotZero(t, comment.ID)
}

func TestCommentDao_FindList(t *testing.T) {
	d := NewCommentDao(setupTestDB(t))
	for range 3 {
		d.Create(&models.Comment{Content: "Comment", UserID: 1, PostID: 1})
	}

	comments, err := d.FindList(1, 0, 2)
	assert.NoError(t, err)
	assert.Len(t, comments, 2)
}
