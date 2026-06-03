#!/bin/bash

token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6ImRlbW8xIiwiZXhwIjoxNzc4NTc3NzQxLCJuYmYiOjE3Nzg0OTEzNDEsImlhdCI6MTc3ODQ5MTM0MX0._EKFKBOvtOM9T7-x0ry3XNZ_QcdNeOrZkIk_ok8ABeA"

# 发贴
curl -X POST http://localhost:8080/api/v1/posts \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer ${token}" \
--data-raw '{
    "title": "demo1",
    "content": "demo1"
}'

# 没有 title
curl -X POST http://localhost:8080/api/v1/posts \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer ${token}" \
--data-raw '{
    "content": "demo1"
}'

# 没有 content
curl -X POST http://localhost:8080/api/v1/posts \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer ${token}" \
--data-raw '{
    "title": "demo1"
}'

# 修改
curl -X PUT http://localhost:8080/api/v1/posts/6 \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer ${token}" \
--data-raw '{
    "title": "test update",
    "content": "test update"
}'

# 修改他人贴
curl -X PUT http://localhost:8080/api/v1/posts/66 \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer ${token}" \
--data-raw '{
    "title": "test update",
    "content": "test update other post"
}'

# 删除
curl -X DELETE http://localhost:8080/api/v1/posts/6 \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer ${token}" \

# 删除他人帖
curl -X DELETE http://localhost:8080/api/v1/posts/66 \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer ${token}" \

# 详情 
curl -X GET http://localhost:8080/api/v1/posts/6
# 列表
curl -X GET http://localhost:8080/api/v1/posts

