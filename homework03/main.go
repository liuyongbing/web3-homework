package main

import (
	"fmt"
	"log"
	"os"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// ============================================================
// 模型定义
// ============================================================

// User 用户模型
type User struct {
	gorm.Model
	Name      string `gorm:"size:100;not null"`
	Email     string `gorm:"size:200;uniqueIndex;not null"`
	Posts     []Post `gorm:"foreignKey:UserID"`
	PostCount int    `gorm:"default:0"`
}

// Post 文章模型 — 一对多：一个 User 拥有多篇 Post
type Post struct {
	gorm.Model
	Title         string    `gorm:"size:200;not null"`
	Content       string    `gorm:"type:text"`
	UserID        uint      `gorm:"index;not null"`
	User          User      `gorm:"foreignKey:UserID"`
	Comments      []Comment `gorm:"foreignKey:PostID"`
	CommentCount  int       `gorm:"default:0"`
	CommentStatus string    `gorm:"size:50;default:无评论"`
}

// Comment 评论模型 — 一对多：一篇 Post 拥有多条 Comment
type Comment struct {
	gorm.Model
	Content string `gorm:"type:text;not null"`
	UserID  uint   `gorm:"index;not null"`
	User    User   `gorm:"foreignKey:UserID"`
	PostID  uint   `gorm:"index;not null"`
	Post    Post   `gorm:"foreignKey:PostID"`
}

// ============================================================
// 钩子函数（题目3）
// ============================================================

// AfterCreate Post 创建后的钩子：自动更新用户的文章数量统计字段
func (p *Post) AfterCreate(tx *gorm.DB) error {
	result := tx.Model(&User{}).
		Where("id = ?", p.UserID).
		UpdateColumn("post_count", gorm.Expr("post_count + 1"))
	if result.Error != nil {
		return result.Error
	}

	var user User
	tx.First(&user, p.UserID)
	fmt.Printf("  [Post AfterCreate 钩子] 用户 %s 的文章数 +1 → %d\n", user.Name, user.PostCount)
	return nil
}

// AfterDelete Comment 删除后的钩子：检查文章评论数，为0则更新状态为"无评论"
func (c *Comment) AfterDelete(tx *gorm.DB) error {
	var count int64
	tx.Model(&Comment{}).
		Where("post_id = ? AND deleted_at IS NULL", c.PostID).
		Count(&count)

	var post Post
	if err := tx.First(&post, c.PostID).Error; err != nil {
		return err
	}

	newStatus := "有评论"
	if count == 0 {
		newStatus = "无评论"
	}

	tx.Model(&post).Updates(map[string]any{
		"comment_count":  count,
		"comment_status": newStatus,
	})

	fmt.Printf("  [Comment AfterDelete 钩子] 文章 [%s] 剩余评论: %d, 状态: %s\n",
		post.Title, count, newStatus)
	return nil
}

// ============================================================
// 主函数
// ============================================================

func main() {
	os.Remove("blog.db")

	db, err := gorm.Open(sqlite.Open("blog.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("连接数据库失败:", err)
	}

	// ========== 题目1：模型定义与建表 ==========
	fmt.Println("===== 题目1：模型定义与建表 =====")

	db.AutoMigrate(&User{}, &Post{}, &Comment{})
	fmt.Println("表创建成功：users, posts, comments")

	user1 := User{Name: "张三", Email: "zhangsan@example.com"}
	user2 := User{Name: "李四", Email: "lisi@example.com"}
	db.Create(&user1)
	db.Create(&user2)

	post1 := Post{Title: "Go并发编程", Content: "goroutine和channel...", UserID: user1.ID}
	post2 := Post{Title: "GORM使用指南", Content: "GORM是Go的ORM库...", UserID: user1.ID}
	post3 := Post{Title: "Web开发实战", Content: "使用Gin框架...", UserID: user2.ID}
	db.Create(&post1)
	db.Create(&post2)
	db.Create(&post3)

	comments := []Comment{
		{Content: "并发讲解很清晰", UserID: user2.ID, PostID: post1.ID},
		{Content: "学到了很多", UserID: user1.ID, PostID: post1.ID},
		{Content: "期待更多教程", UserID: user2.ID, PostID: post2.ID},
		{Content: "Gin确实好用", UserID: user1.ID, PostID: post3.ID},
		{Content: "实战案例很棒", UserID: user2.ID, PostID: post3.ID},
		{Content: "收藏了", UserID: user1.ID, PostID: post3.ID},
	}
	for _, c := range comments {
		db.Create(&c)
	}

	// 更新统计字段
	db.Model(&post1).Updates(map[string]any{"comment_count": 2, "comment_status": "有评论"})
	db.Model(&post2).Updates(map[string]any{"comment_count": 1, "comment_status": "有评论"})
	db.Model(&post3).Updates(map[string]any{"comment_count": 3, "comment_status": "有评论"})

	fmt.Println("测试数据插入完成")

	// ========== 题目2：关联查询 ==========
	fmt.Println("\n===== 题目2：关联查询 =====")

	// 查询1：查询某个用户发布的所有文章及其评论
	fmt.Printf("\n--- 查询用户 [%s] 的所有文章及评论 ---\n", user1.Name)
	var posts []Post
	db.Preload("Comments").Preload("Comments.User").
		Where("user_id = ?", user1.ID).
		Find(&posts)

	for _, p := range posts {
		fmt.Printf("文章: %s (评论数: %d)\n", p.Title, len(p.Comments))
		for _, c := range p.Comments {
			fmt.Printf("  - %s (by %s)\n", c.Content, c.User.Name)
		}
	}

	// 查询2：评论数量最多的文章
	fmt.Println("\n--- 评论数量最多的文章 ---")
	type PostCommentCount struct {
		PostID uint
		Count  int
	}
	var pcc PostCommentCount
	db.Model(&Comment{}).
		Select("post_id, count(*) as count").
		Group("post_id").
		Order("count DESC").
		First(&pcc)

	var topPost Post
	db.Preload("User").Preload("Comments").First(&topPost, pcc.PostID)
	fmt.Printf("标题: %s\n", topPost.Title)
	fmt.Printf("作者: %s\n", topPost.User.Name)
	fmt.Printf("评论数: %d\n", pcc.Count)

	// ========== 题目3：钩子函数 ==========
	fmt.Println("\n===== 题目3：钩子函数 =====")

	// 演示 Post AfterCreate 钩子
	fmt.Println("\n--- 创建新文章（触发 Post AfterCreate 钩子）---")
	hookPost := Post{Title: "设计模式详解", Content: "工厂模式、单例模式...", UserID: user1.ID}
	db.Create(&hookPost)

	// 再创建一篇
	hookPost2 := Post{Title: "微服务架构", Content: "服务拆分与治理...", UserID: user1.ID}
	db.Create(&hookPost2)

	// 验证用户文章数
	db.First(&user1, user1.ID)
	fmt.Printf("用户 %s 当前文章总数: %d\n", user1.Name, user1.PostCount)

	// 演示 Comment AfterDelete 钩子
	fmt.Println("\n--- 删除评论（触发 Comment AfterDelete 钩子）---")
	// 给 hookPost 添加两条评论
	c1 := Comment{Content: "设计模式讲得好", UserID: user2.ID, PostID: hookPost.ID}
	c2 := Comment{Content: "期待更新", UserID: user1.ID, PostID: hookPost.ID}
	db.Create(&c1)
	db.Create(&c2)
	db.Model(&hookPost).Updates(map[string]any{"comment_count": 2, "comment_status": "有评论"})

	fmt.Println("删除第1条评论:")
	db.Delete(&c1)

	fmt.Println("删除第2条评论:")
	db.Delete(&c2)

	fmt.Println("\n===== 所有题目运行完成 =====")
}
