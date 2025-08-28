import User from '../models/user.js'
// 引入 HTTP 狀態碼常數
import { StatusCodes } from 'http-status-codes'
// 讓前端儲存登入狀態的安全方式
import jwt from 'jsonwebtoken'
import validator from 'validator'
import Product from '../models/product.js'

// 註冊用戶
export const create = async (req, res) => {
  try {
    // User.create() 是 Mongoose 提供的方法，用來新增資料
    await User.create({
      account: req.body.account,
      email: req.body.email,
      password: req.body.password,
    })
    res.status(StatusCodes.CREATED).json({
      success: true,
      message: '',
    })
  } catch (error) {
    console.error(error)
    // 處理 Mongoose 驗證錯誤
    if (error.name === 'ValidationError') {
      // error.errors 是一個物件，裡面每個欄位都對應一個驗證錯誤，例如：{ account: {...}, email: {...} }
      // 拿第一個錯誤的欄位名稱，例如：'account'
      const key = Object.keys(error.errors)[0]
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        // 取得這個欄位的錯誤資訊的錯誤訊息，例如：帳號至少4個字
        message: error.errors[key].message,
      })
      // 如果錯誤是 MongoDB 的「唯一鍵衝突」，也就是 account 或 email 重複了（schema 裡設定過 unique: true）
    } else if (error.name === 'MongoServerError' && error.code === 11000) {
      res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: '使用者已存在',
      })
      // 其他未知錯誤
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '伺服器內部錯誤',
      })
    }
  }
}

// 登入用戶
export const login = async (req, res) => {
  try {
    // https://github.com/auth0/node-jsonwebtoken?tab=readme-ov-file#jwtsignpayload-secretorprivatekey-options-callback
    // 使用 jsonwebtoken 的 jwt.sign()：產生 token
    const token = jwt.sign({ _id: req.user._id }, process.env.JWT_SECRET, { expiresIn: '7 days' })
    // 把產生的 token 存進使用者物件的 tokens 陣列裡（用來記錄有效 token）
    req.user.tokens.push(token)
    // 將修改後的使用者資料存回資料庫
    await req.user.save()
    res.status(StatusCodes.OK).json({
      success: true,
      message: '登入成功',
      user: {
        account: req.user.account,
        email: req.user.email,
        role: req.user.role,
        cartTotal: req.user.cartTotal,
        bio: req.user.bio,
        theme: req.user.theme,
        avatar: req.user.avatar,
        // 回傳 token 給前端使用
        token,
      },
    })
  } catch (error) {
    console.log('controllers/user.js login')
    console.error(error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器內部錯誤',
    })
  }
}

// 取得使用者個人資料
export const profile = (req, res) => {
  res.status(StatusCodes.OK).json({
    success: true,
    user: {
      _id: req.user._id, // Add this line
      account: req.user.account,
      email: req.user.email,
      role: req.user.role,
      cartTotal: req.user.cartTotal,
      bio: req.user.bio,
      theme: req.user.theme,
      avatar: req.user.avatar,
    },
  })
}

// 更新使用者資料
export const updateProfile = async (req, res) => {
  try {
    // 先處理欄位字串
    req.body.account = req.body.account?.trim()
    req.body.email = req.body.email?.trim()
    req.body.bio = req.body.bio?.trim()

    const allowedUpdates = ['account', 'email', 'bio', 'theme', 'role']
    const updates = Object.keys(req.body).filter(
      (key) => req.body[key] !== undefined && req.body[key] !== null,
    )
    const isValidOperation = updates.every((update) => allowedUpdates.includes(update))

    if (!isValidOperation) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '無效的更新欄位',
      })
    }

    // 特殊處理主題設定，確保它是 'light' 或 'dark'
    if (updates.includes('theme') && !['light', 'dark'].includes(req.body.theme)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '主題設定必須是 light 或 dark',
      })
    }

    updates.forEach((update) => {
      req.user[update] = req.body[update]
    })

    await req.user.save()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '資料更新成功',
      user: {
        account: req.user.account,
        email: req.user.email,
        role: req.user.role,
        cartTotal: req.user.cartTotal,
        bio: req.user.bio,
        theme: req.user.theme,
        avatar: req.user.avatar,
      },
    })
  } catch (error) {
    console.error(error)
    if (error.name === 'ValidationError') {
      const key = Object.keys(error.errors)[0]
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: error.errors[key].message,
      })
    } else if (error.name === 'MongoServerError' && error.code === 11000) {
      res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: '帳號或信箱已被使用',
      })
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '伺服器內部錯誤',
      })
    }
  }
}

// 刷新使用者的 JWT token
export const refresh = async (req, res) => {
  try {
    // 找出目前這個 token 在陣列裡的位置（索引值），存到 i
    // req.user.tokens 是目前使用者身上的有效 token 陣列，req.token 是當前請求所帶的 token 字串
    const i = req.user.tokens.indexOf(req.token)
    const token = jwt.sign({ _id: req.user._id }, process.env.JWT_SECRET, { expiresIn: '7 days' })
    // 把舊的 token 位置（i）替換成新產生的 token
    req.user.tokens[i] = token
    await req.user.save()
    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      token,
    })
  } catch (error) {
    console.log('controllers/user.js refresh')
    console.error(error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器內部錯誤',
    })
  }
}

// 使用者登出
export const logout = async (req, res) => {
  try {
    // 從 tokens 中移除當前的 token
    req.user.tokens = req.user.tokens.filter((token) => token !== req.token)
    await req.user.save()
    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
    })
  } catch (error) {
    console.log('controllers/user.js logout')
    console.error(error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器內部錯誤',
    })
  }
}

// 新增修改購物車
export const cart = async (req, res) => {
  try {
    // 驗證請求的商品 ID
    if (!validator.isMongoId(req.body.product)) {
      throw new Error('PRODUCT ID')
    }
    // 檢查商品是否存在
    await Product.findOne({ _id: req.body.product }).orFail(new Error('PRODUCT NOT FOUND'))

    // 檢查購物車中是否已經有該商品
    // 購物車內的 product 資料型態是 ObjectId，使用 .toString() 轉換為字串進行比較
    const i = req.user.cart.findIndex((item) => item.product.toString() === req.body.product)
    // 如果購物車中已經有該商品，則增加數量
    if (i > -1) {
      req.user.cart[i].quantity += req.body.quantity
      if (req.user.cart[i].quantity < 1) {
        // 如果數量小於 1，則從購物車中移除該商品
        req.user.cart.splice(i, 1)
      }
    }
    // 如果購物車中沒有該商品，且數量 > 0，則新增商品到購物車
    else if (req.body.quantity > 0) {
      req.user.cart.push({
        product: req.body.product,
        quantity: req.body.quantity,
      })
    }
    // 保存
    await req.user.save()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: req.user.cartTotal,
    })
  } catch (error) {
    console.error(error)
    if (error.message === 'USER ID') {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '使用者 ID 格式錯誤',
      })
    } else if (error.message === 'PRODUCT ID') {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '商品 ID 格式錯誤',
      })
    } else if (error.message === 'PRODUCT NOT FOUND') {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '商品不存在',
      })
    } else if (error.message === 'USER NOT FOUND') {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '使用者不存在',
      })
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '伺服器內部錯誤',
      })
    }
  }
}

// 取得購物車
export const getCart = async (req, res) => {
  try {
    // email account        --> 只取 email 和 account 欄位
    // -password -email     --> 除了 password 和 email 以外的欄位
    const user = await User.findById(req.user._id, 'cart')
      // .populate(ref欄位, 指定取的欄位)
      // 關聯 cart.product 的 ref 指定的 collection，只取 name 欄位
      // .populate('cart.product', 'name')
      .populate('cart.product')
      .orFail(new Error('USER NOT FOUND'))

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: user.cart,
    })
  } catch (error) {
    if (error.message === 'USER ID') {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '使用者 ID 格式錯誤',
      })
    } else if (error.message === 'USER NOT FOUND') {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '使用者不存在',
      })
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '伺服器內部錯誤',
      })
    }
  }
}

// Add to favorites
export const addFavorite = async (req, res) => {
  try {
    if (!validator.isMongoId(req.body.product)) {
      throw new Error('PRODUCT ID')
    }
    await Product.findById(req.body.product).orFail(new Error('PRODUCT NOT FOUND'))

    const isFavorited = req.user.favorites.some(fav => fav.toString() === req.body.product)
    if (isFavorited) {
      return res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: '商品已在收藏中'
      })
    }

    req.user.favorites.push(req.body.product)
    await req.user.save()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '收藏成功',
      result: req.user.favorites
    })
  } catch (error) {
    console.error(error)
    if (error.message === 'PRODUCT ID') {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '商品 ID 格式錯誤'
      })
    } else if (error.message === 'PRODUCT NOT FOUND') {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '商品不存在'
      })
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '伺服器內部錯誤'
      })
    }
  }
}

// Remove from favorites
export const removeFavorite = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) {
      throw new Error('PRODUCT ID')
    }

    const productIndex = req.user.favorites.findIndex(fav => fav.toString() === req.params.id)

    if (productIndex === -1) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '收藏中無此商品'
      })
    }

    req.user.favorites.splice(productIndex, 1)
    await req.user.save()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '取消收藏成功',
      result: req.user.favorites
    })
  } catch (error) {
    console.error(error)
    if (error.message === 'PRODUCT ID') {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '商品 ID 格式錯誤'
      })
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '伺服器內部錯誤'
      })
    }
  }
}

// Get favorites
export const getFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user._id, 'favorites').populate('favorites')
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '使用者不存在'
      })
    }
    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: user.favorites
    })
  } catch (error) {
    console.error(error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器內部錯誤'
    })
  }
}