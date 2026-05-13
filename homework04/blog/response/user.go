package response

import "nadaona.com/web3-homework/blog/models"

type UserRes struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

func NewUserRes(u *models.User) UserRes {
	return UserRes{ID: u.ID, Username: u.Username, Email: u.Email}
}
