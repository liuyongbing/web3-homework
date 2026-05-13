package routes

import (
	"time"

	"github.com/gin-gonic/gin"

	"nadaona.com/web3-homework/blog/handlers"
	"nadaona.com/web3-homework/blog/middlewares"
	"nadaona.com/web3-homework/blog/response"
)

func Register(r *gin.Engine, repos handlers.Repos, auth *middlewares.Auth) {
	uh := handlers.NewUserHandler(repos.Users, auth)
	ph := handlers.NewPostHandler(repos.Posts)
	ch := handlers.NewCommentHandler(repos.Comments, repos.Posts)

	r.GET("/", func(c *gin.Context) {
		response.OK(c, gin.H{"time": time.Now().Format(time.DateTime)})
	})
	r.GET("/health", func(c *gin.Context) { response.OK(c, nil) })
	r.GET("/ping", func(c *gin.Context) { response.OK(c, gin.H{"message": "pong"}) })

	users := r.Group("/api/v1/users")
	users.POST("", uh.Register)
	users.POST("/login", uh.Login)

	posts := r.Group("/api/v1/posts")
	posts.GET("", ph.List)
	posts.GET("/:id", ph.Detail)
	posts.POST("", auth.Middleware(), ph.Create)
	posts.PUT("/:id", auth.Middleware(), ph.Update)
	posts.DELETE("/:id", auth.Middleware(), ph.Delete)

	comments := r.Group("/api/v1/comments")
	comments.GET("/post/:post_id", ch.List)
	comments.POST("", auth.Middleware(), ch.Create)
}
