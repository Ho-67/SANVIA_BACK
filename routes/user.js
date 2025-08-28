import { Router } from 'express'
// 建立新使用者
// import { create } from '../controllers/user.js'
// 驗證使用者有沒有登入（例如檢查 JWT token）
// import auth from '../middlewares/auth.js'

// 換成 import * as 模組名稱，多個函式包成物件集中管理
import * as user from '../controllers/user.js'
import * as auth from '../middlewares/auth.js'

const router = Router()

// 只要發送 POST 請求到 /user 時，就會執行 create 函式
// router.post('/', create)
router.post('/', user.create)
router.post('/login', auth.login, user.login)
router.get('/profile', auth.token, user.profile)
router.patch('/profile', auth.token, user.updateProfile)
router.patch('/refresh', auth.token, user.refresh)
router.delete('/logout', auth.token, user.logout)
router.patch('/cart', auth.token, user.cart)
router.get('/cart', auth.token, user.getCart)

// favorites
router.post('/favorites', auth.token, user.addFavorite)
router.delete('/favorites/:id', auth.token, user.removeFavorite)
router.get('/favorites', auth.token, user.getFavorites)

export default router
