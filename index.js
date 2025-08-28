// dotenv/config 會自動從 .env 檔案加載變數，可以在程式中以 process.env 方式使用
import 'dotenv/config'
// 導入 Express 庫，是 Node.js Web 應用框架，可以建立 Web 伺服器、處理 HTTP 請求和回應
import express from 'express'
import mongoose from 'mongoose'
import userRouter from './routes/user.js'
import orderRouter from './routes/order.js'
import './passport.js'
import { StatusCodes } from 'http-status-codes'
// 跨來源資源分享
import cors from 'cors'
import productRouter from './routes/product.js'
import diceRollsRouter from './routes/diceRolls.js'
import questionRouter from './routes/question.js'

// 使用 Mongoose 來連接 MongoDB 資料庫
mongoose
  .connect(process.env.DB_URL)
  .then(() => {
    console.log('資料庫連線成功')
    // 自動移除危險的 MongoDB 運算子
    mongoose.set('sanitizeFilter', true)
  })
  .catch((error) => {
    console.log('資料庫連線失敗')
    console.error('資料庫連線失敗', error)
  })

// 創建一個新的 Express 應用（伺服器實例），可以用來設定路由、處理請求、設定中介軟體等
const app = express()
// 讓所有的前端網域都可以來存取 API
app.use(cors())

// 讓 Express 應用可以處理 JSON 格式的請求體
// express.json() 是內建的middleware，它會將所有進來的 HTTP 請求中 Content-Type 是 application/json 的部分，自動解析為 JavaScript 物件
app.use(express.json())
// 防止惡意請求和開發除錯
app.use((error, req, res, next) => {
  res.status(StatusCodes.BAD_REQUEST).json({
    success: false,
    message: 'JSON格式錯誤',
  })
})

app.use('/user', userRouter)
app.use('/order', orderRouter)
app.use('/product', productRouter)
app.use('/diceRolls', diceRollsRouter)
app.use('/questions', questionRouter)

// Add a basic route for the root path
app.get('/', (req, res) => {
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Server is alive!'
  })
})

// 處理未定義的路由
// /.*?/ 是匹配任何路徑
app.all(/.*/, (req, res) => {
  //  req.method：HTTP 方法，req.originalUrl：使用者實際請求的完整路徑
  console.log('找不到路由：', req.method, req.originalUrl)
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: '找不到該路由',
  })
})

// 啟動 Express 伺服器，接收來自客戶端的請求
app.listen(process.env.port || 4000, () => {
  console.log('伺服器啟動')
})
