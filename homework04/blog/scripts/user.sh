#!/bin/bash

# users 注册
curl -X POST http://localhost:8080/api/v1/users \
--header 'Content-Type: application/json' \
--data-raw '{
    "username": "demo1",
    "password": "demo1",
    "email": "test@demo.com"
}'

# users 注册
curl -X POST http://localhost:8080/api/v1/users \
--header 'Content-Type: application/json' \
--data-raw '{
    "username": "liuliu",
    "password": "liuliu",
    "email": "liuliu@liuliu.com"
}'

# users 注册
curl -X POST http://localhost:8080/api/v1/users \
--header 'Content-Type: application/json' \
--data-raw '{
    "username": "demo1",
    "password": "demo1",
    "email": "test@demo.com"
}'

# 登录
curl -X POST http://localhost:8080/api/v1/users/login \
--header 'Content-Type: application/json' \
--data-raw '{
    "username": "demo1",
    "password": "demo1"
}'
