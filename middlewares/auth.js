import passport from 'passport'
import { StatusCodes } from 'http-status-codes'
import jwt from 'jsonwebtoken'

// 這是 Express 的 controller 函式（負責 login 邏輯）
// 裡面使用 passport.authenticate(...) 這個 middleware 來驗證帳密
export const login = (req, res, next) => {
  // 使用 passport 的 login 驗證策略
  // passport.authenticate(驗證方法, 設定, 處理function)
  // 設定不使用 session（常用在 JWT）= 停用 cookie
  // 處理function 的 (error, user, info) 對應 done() 的三個東西
  passport.authenticate('login', { session: false }, (error, user, info) => {
    if (!user || error) {
      // 檢查錯誤訊息是不是沒填帳密
      if (info?.message === 'Missing credentials') {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '請提供帳號密碼',
        })
        // 沒有程式錯誤，但 info 裡有訊息（例如帳號不存在、密碼錯）
      } else if (!error && info) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: info.message,
        })
        // 其他錯誤（例如資料庫掛掉）
      } else {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: '伺服器內部錯誤',
        })
      }
    }
    // 如果帳密正確，會有 user，把使用者資料存到 req.user 給後續的 middleware 或 controller 使用
    req.user = user
    next()
    // 所以整段 passport.authenticate('login', { session: false }, callback)(req, res, next)
    // 等於 const middleware = passport.authenticate(...) // 這只是在「拿到函式」
    // middleware(req, res, next) // 這才是真正「執行」它
  })(req, res, next)
}

export const token = (req, res, next) => {
  // 'jwt': 表示使用 passport-jwt 的策略
  // data: 驗證成功後的資料，通常裡面會有 user、token 等資訊
  passport.authenticate('jwt', { session: false }, (error, data, info) => {
    console.log('passport.js token')
    console.log(error, data, info)
    if (!data || error) {
      // 是不是 JWT 錯誤，可能是過期、格式錯誤、SECRET 錯誤等
      if (info instanceof jwt.JsonWebTokenError) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '無效的token',
        })
        // 其他 info，可能是查無使用者
      } else if (info) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: info.message || '無效的token',
        })
        // 沒有 info，但是有錯誤
      } else {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: '伺服器內部錯誤',
        })
      }
    }
    req.user = data.user
    req.token = data.token
    next()
  })(req, res, next)
}

export const seller = (req, res, next) => {
  // 檢查使用者身分是否為賣家
  if (req.user.role !== 'seller') {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: '沒有權限存取此資源',
    })
  }
  next()
}
