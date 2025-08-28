// 身份驗證
import passport from 'passport'
// Passport 的一種策略，意思是用「帳號密碼」來驗證使用者
import passportLocal from 'passport-local'
// 密碼加密和驗證
import bcrypt from 'bcrypt'
import User from './models/user.js'
import passportJWT from 'passport-jwt'

passport.use(
  // 自定義名稱
  'login',
  // 登入策略
  new passportLocal.Strategy(
    {
      // 用戶名欄位是 account，密碼欄位是 password
      usernameField: 'account',
      passwordField: 'password',
    },
    // Passport 驗證函式，傳入 account 和 password
    async (account, password, done) => {
      try {
        // User.findOne({ account })： 在資料庫找帳號符合的使用者
        // .orFail(new Error()) ：如果找不到這個使用者，丟出錯誤
        const user = await User.findOne({ $or: [{ account: account }, { email: account }] }).orFail(
          new Error('USER NOT FOUND'),
        )
        // bcrypt.compareSync 會回傳 true 或 false
        // 比較前端輸入的密碼 password 和資料庫裡加密過的密碼 user.password
        if (!bcrypt.compareSync(password, user.password)) {
          throw new Error('PASSWORD')
        }
        // done(錯誤, 使用者資料, 通常說明失敗原因)
        return done(null, user)
      } catch (error) {
        console.log('passport.js login')
        console.error(error)
        if (error.message === 'USER NOT FOUND') {
          return done(null, false, { message: '使用者不存在' })
        } else if (error.message === 'PASSWORD') {
          return done(null, false, { message: '密碼錯誤' })
        } else {
          return done(error)
        }
      }
    },
  ),
)

passport.use(
  'jwt',
  new passportJWT.Strategy(
    {
      // JWT（JSON Web Token）裡面包含了三部分：Header（標頭），Payload（有效載荷），Signature（簽章）
      // 指定從 HTTP Header 的 Authorization: Bearer <token> 取得 JWT
      jwtFromRequest: passportJWT.ExtractJwt.fromAuthHeaderAsBearerToken(),
      // 驗證 JWT
      secretOrKey: process.env.JWT_SECRET,
      // 表示驗證函式的第一個參數是 req（請求物件），可以在驗證裡用
      passReqToCallback: true,
      // 忽略過期時間，因為舊換新的時候可以允許過期的 token
      ignoreExpiration: true,
    },
    // req 必須要設定 passReqToCallback 才能使用
    // 因為 Passport JWT 套件只給把裡面的 Payload 拿出來，所以完整的需要自己從 req 裡面拿
    // payload: JWT 解碼後的內容（token 裡的資料，像是使用者 id 等）
    async (req, payload, done) => {
      console.log('--- JWT Strategy Callback ---'); // Added log
      console.log('Request URL:', req.baseUrl + req.path); // Added log
      console.log('Payload:', payload); // Added log
      try {
        // const token = req.headers.authorization.split(' ')[1]
        const token = passportJWT.ExtractJwt.fromAuthHeaderAsBearerToken()(req)
        // payload.exp 是 JWT 的過期時間，單位是秒，所以要乘以 1000 轉成毫秒
        const expired = payload.exp * 1000 < Date.now()
        // 請求的路徑
        const url = req.baseUrl + req.path
        // 手動檢查過期，只有 refresh 和 logout 可以允許過期的 token
        if (expired && url !== '/user/refresh' && url !== '/user/logout') {
          console.log('Token expired for non-refresh/logout route.'); // Added log
          throw new Error('TOKEN EXPIRED')
        }

        // 檢查使用者是否存在，並且 tokens 裡面有這個 token
        const user = await User.findOne({ _id: payload._id, tokens: token }).orFail(
          new Error('USER NOT FOUND'),
        )
        console.log('User found and token valid.'); // Added log
        return done(null, { user, token })
      } catch (error) {
        console.log('JWT Strategy Error:', error); // Added log
        console.error(error)
        if (error.message === 'USER NOT FOUND') {
          return done(null, false, { message: '使用者不存在或 token 已失效' })
        } else if (error.message === 'TOKEN EXPIRED') {
          return done(null, false, { message: 'token 已過期' })
        } else {
          return done(error)
        }
      }
    },
  ),
)
