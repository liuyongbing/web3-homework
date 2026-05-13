#!/bin/bash

token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6ImRlbW8xIiwiZXhwIjoxNzc4NTc3NzQxLCJuYmYiOjE3Nzg0OTEzNDEsImlhdCI6MTc3ODQ5MTM0MX0._EKFKBOvtOM9T7-x0ry3XNZ_QcdNeOrZkIk_ok8ABeA"

# 点赞
curl -X POST http://localhost:8080/api/v1/comments \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer ${token}" \
--data-raw '{
    "post_id": 66,
    "content": "demo1"
}'

# 点赞
curl -X POST http://localhost:8080/api/v1/comments \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer ${token}" \
--data-raw '{
    "post_id": 6,
    "content": "not exists post"
}'

# 列表
curl -X GET http://localhost:8080/api/v1/comments/post/66
