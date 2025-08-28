// Mongoose 是一個 MongoDB 的 ODM（物件資料映射）庫，可以使用 JavaScript 物件來操作 MongoDB 資料庫，並提供資料模型定義、驗證、CRUD 操作及中間件等功能
import { Schema, Error, model } from 'mongoose'
// 驗證字串
import validator from 'validator'
// 加密密碼
import bcrypt from 'bcrypt'

// 購物車項目(子資料模型)
const cartSchema = new Schema(
  {
    product: {
      // ObjectId通常用於建立多對多關聯
      type: Schema.Types.ObjectId,
      ref: 'product',
      required: [true, '商品ID必填'],
    },
    quantity: {
      type: Number,
      required: [true, '數量必填'],
      min: [1, '數量最少為1'],
      max: [9999, '數量最多為9999'],
    },
  },
  { versionKey: false },
)

// 整個使用者資料(父資料模型)
const schema = new Schema(
  {
    account: {
      type: String,
      required: [true, '帳號必填'],
      minlength: [4, '帳號至少4個字'],
      maxlength: [20, '帳號最多20個字'],
      unique: true,
      trim: true,
      validate: {
        validator(value) {
          // 檢查帳號是否只包含字母和數字
          return validator.isAlphanumeric(value)
        },
      },
    },
    email: {
      type: String,
      required: [true, '電子郵件必填'],
      unique: true,
      trim: true,
      validate: {
        validator(value) {
          // 是否為有效的電子郵件格式
          return validator.isEmail(value)
        },
        message: '請輸入有效的電子郵件地址',
      },
    },
    cart: {
      // 嵌套
      type: [cartSchema],
    },
    favorites: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: 'product'
        }
      ]
    },
    tokens: {
      type: [String],
    },
    role: {
      type: String,
      enum: ['buyer', 'seller'],
      default: 'buyer',
    },
    password: {
      type: String,
      required: [true, '密碼必填'],
    },
    bio: {
      type: String,
    },
    avatar: {
      type: String,
    },
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light',
    },
  },
  {
    // 禁用 Mongoose 自動加上的 __v 欄位，讓資料結構更簡潔
    versionKey: false,
    //  讓 Mongoose 自動為每個文檔加上 createdAt 和 updatedAt 時間戳記欄位
    timestamps: true,
  },
)

// 在儲存使用者資料前，先對密碼進行檢查和加密
// Mongoose 中的 middleware
// pre('save'): pre 代表 "在保存資料之前"，會在每次嘗試保存 user 資料時執行
// function (next): 自定義函數，會在 save 事件發生前執行，並且會傳遞一個 next 函數，如果不呼叫 next，資料就不會被儲存下來
schema.pre('save', function (next) {
  // this = 現在要保存的資料，也就是現在正在操作的 user 資料模型
  const user = this
  // isModified('password'): Mongoose 提供的函數，如果密碼欄位有修改(返回 true)才進行加密
  if (user.isModified('password')) {
    if (user.password.length < 4 || user.password.length > 20) {
      // ValidationError（驗證錯誤）
      const error = new Error.ValidationError()
      error.addError(
        'password',
        new Error.ValidationError({ message: '密碼長度必須在 4 到 20 個字元之間' }),
      )
      next(error)
      return
    } else {
      // 密碼格式符合要求，使用 bcrypt 加密密碼
      user.password = bcrypt.hashSync(user.password, 10)
    }
  }
  // 限制有效 token 數量
  if (user.isModified('tokens') && user.tokens.length > 3) {
    // shift() 是刪掉陣列第一個元素
    user.tokens.shift()
  }
  // 繼續處理
  next()
})

// virtual 是 Mongoose 提供的一個方法，用來定義虛擬動態欄位
// cartTotal 是自定義虛擬欄位名稱，這個欄位可以像普通的欄位一樣被訪問，但是它的值不會存儲在資料庫裡
// .get() 為虛擬欄位定義一個 getter 函數，在訪問 cartTotal 欄位時執行
schema.virtual('cartTotal').get(function () {
  const user = this
  // user.cart：這是一個陣列，包含了使用者購物車中的所有商品項目，每個項目由 cartSchema 定義
  // reduce()：reduce 是一個 JavaScript 陣列方法，它會遍歷 cart 陣列中的每一個 item，並通過一個累加器 total 把每個 item.quantity 的值加總起來
  return user.cart.reduce((total, item) => {
    return total + item.quantity
  }, 0)
})

// 將 schema 和 model 結合，users 是模型名稱，schema 是這個模型的資料結構
// 使用 User 模型來操作 users 資料表（集合）中的資料
export default model('users', schema)
