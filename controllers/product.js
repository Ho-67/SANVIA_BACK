import Product from '../models/product.js'
import Review from '../models/review.js'
import { StatusCodes } from 'http-status-codes'
import validator from 'validator'
import mongoose from 'mongoose'

// 建立新商品
export const create = async (req, res) => {
  try {
    const { name, price, emotions, category, details, description, sell, roll } = req.body

    console.log('建立商品，req.body:', req.body)
    console.log('建立商品，req.files:', req.files) // 這裡看檔案上傳有無成功

    // 基本資料驗證
    if (!name || !price || !emotions || !category || !description) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '必填欄位未填寫完整',
      })
    }

    // 驗證價格格式
    if (price !== undefined) {
      const parsedPrice = parseInt(price, 10)
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '情緒價值必須為非負數',
        })
      }
    }

    // 檢查是否有上傳圖片
    if (!req.files?.images || req.files.images.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '至少需要一張商品圖片',
      })
    }

    // 確認 features, specifications 的解析結果
    console.log('features（解析後）:', JSON.parse(req.body.features || '[]'))
    console.log('specifications（解析後）:', JSON.parse(req.body.specifications || '[]'))

    // 取得動態媒體檔案
    console.log('動態媒體檔案:', req.files.dynamicMedia)

    // 建立商品前，處理所有圖片路徑
    const imagePaths = req.files.images.map((file) => file.path)
    console.log('所有圖片路徑:', imagePaths)
    // 第一張圖片作為封面圖
    const coverImage = imagePaths[0]
    console.log('封面圖路徑:', coverImage)

    // 解析 features 和 specifications 的 JSON 字串，並提供預設空陣列
    const features = JSON.parse(req.body.features || '[]')
    const specifications = JSON.parse(req.body.specifications || '[]')

    // 取得所有動態上傳的檔案路徑
    const dynamicMediaFiles = req.files.dynamicMedia || []

    let fileIndex = 0

    // 遍歷 features 和 specifications，將新上傳檔案的路徑填入
    const fillInFilePaths = (items) => {
      return items.map((item) => {
        // content 預期為一個陣列
        if (Array.isArray(item.content)) {
          const newContent = item.content.map((contentValue) => {
            // 如果是 placeholder，就從上傳的檔案中取一個路徑替換
            if (contentValue === '__HAS_FILE__') {
              const file = dynamicMediaFiles[fileIndex]
              if (file) {
                fileIndex++
                return file.path
              }
              throw new Error('動態檔案數量與內容不匹配')
            }
            // 否則，保留原來的值 (文字內容或既有的 URL)
            return contentValue
          })
          return { ...item, content: newContent }
        }
        // 如果 content 不是陣列 (例外情況)，直接返回原項目
        return item
      })
    }

    const processedFeatures = fillInFilePaths(features)
    const processedSpecifications = fillInFilePaths(specifications)

    // 建立新商品
    const product = await Product.create({
      seller: req.user._id, // 寫入賣家 ID
      name,
      price,
      emotions,
      category,
      details,
      images: imagePaths,
      image: coverImage,
      description,
      features: processedFeatures,
      specifications: processedSpecifications,
      sell: sell === 'true',
      roll: roll === 'true',
    })

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: '商品建立成功',
      product,
    })
  } catch (error) {
    console.log('controllers/product.js create')
    console.error(error)
    if (error.name === 'SyntaxError') {
      // 處理 JSON 解析錯誤
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '動態內容資料格式錯誤',
      })
    } else if (error.message === '動態檔案數量與內容不匹配') {
      // 處理自訂的檔案數量不匹配錯誤
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '動態檔案數量與內容不匹配，請重新確認',
      })
    } else if (error.name === 'ValidationError') {
      const key = Object.keys(error.errors)[0]
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: error.errors[key].message,
      })
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '伺服器內部錯誤',
      })
    }
  }
}

// 取得所有商品並支援篩選條件
export const getAll = async (req, res) => {
  try {
    const { startDate, endDate, search } = req.query

    // 建立搜尋條件物件
    const filter = {
      seller: req.user._id, // 只查詢目前登入賣家的商品
    }

    // 驗證日期格式
    if (startDate && !validator.isISO8601(startDate)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '起始日期格式無效',
      })
    }
    if (endDate && !validator.isISO8601(endDate)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '結束日期格式無效',
      })
    }

    // 如果有開始日期，設定建立日期 >= startDate
    if (startDate) {
      filter.createdAt = { ...filter.createdAt, $gte: new Date(startDate) }
    }
    // 如果有結束日期，設定建立日期 <= endDate
    if (endDate) {
      filter.createdAt = { ...filter.createdAt, $lte: new Date(endDate) }
    }
    // 如果有關鍵字，使用正規表示式模糊搜尋多個欄位
    if (search) {
      const regex = new RegExp(search.trim(), 'i') // i 忽略大小寫，trim() 去除空白
      filter.$or = [
        { name: regex },
        { description: regex },
        { category: regex },
        { details: regex },
        { 'features.content': regex },
        { 'specifications.content': regex },
      ]
    }
    // 依條件查詢，並限制返回結果數量
    const products = await Product.find(filter).sort({ createdAt: -1 }).limit(100) // 限制最多返回 100 筆資料

    res.status(StatusCodes.OK).json({
      success: true,
      message: '商品列表取得成功',
      products,
    })
  } catch (error) {
    console.error('controllers/product.js getAll', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器內部錯誤',
    })
  }
}

// 取得正在販售的商品
export const get = async (req, res) => {
  try {
    const { search, category, emotions } = req.query

    // --- Aggregation Pipeline --- //
    const pipeline = []

    // Stage 1: $lookup to join with users collection
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'seller',
        foreignField: '_id',
        as: 'sellerInfo',
      },
    })

    // Stage 2: $unwind the sellerInfo array
    pipeline.push({
      $unwind: '$sellerInfo',
    })

    // Stage 3: $match stage for all filtering
    const matchStage = {
      sell: true, // 只查詢正在販售的商品
    }

    if (category) {
      matchStage.category = category
    }

    if (emotions) {
      matchStage.emotions = emotions
    }

    if (search) {
      const regex = new RegExp(search, 'i')
      matchStage.$or = [
        { name: regex },
        { description: regex },
        { details: regex },
        { 'sellerInfo.account': regex }, // Search by seller's account name
      ]
    }

    pipeline.push({ $match: matchStage })

    // Stage 4: $sort stage (optional, keeping original behavior)
    pipeline.push({ $sort: { createdAt: -1 } })

    // Execute aggregation pipeline
    const products = await Product.aggregate(pipeline)

    res.status(StatusCodes.OK).json({
      success: true,
      message: '商品列表取得成功',
      products,
    })
  } catch (error) {
    console.error('controllers/product.js get', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器內部錯誤',
    })
  }
}

// 更新商品
export const update = async (req, res) => {
  try {
    const { id } = req.params

    console.log('更新商品，商品ID:', id)
    console.log('更新商品，req.body:', req.body)
    console.log('更新商品，req.files:', req.files) // 看是否有收到檔案

    if (!validator.isMongoId(id)) {
      console.log('無效的商品ID格式:', id)
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '無效的商品 ID',
      })
    }

    const { name, price, emotions, category, details, description, sell, roll, existingImages } =
      req.body

    const parsedPrice = parseInt(price, 10)
    console.log('解析後的價格:', parsedPrice)

    if (price !== undefined && (isNaN(parsedPrice) || parsedPrice < 0)) {
      console.log('價格格式錯誤:', req.body.price)
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '情緒價值必須為非負數',
      })
    }

    // 解析 features 和 specifications 的 JSON 字串，並提供預設空陣列
    const features = JSON.parse(req.body.features || '[]')
    const specifications = JSON.parse(req.body.specifications || '[]')

    // 取得所有動態上傳的檔案路徑
    const dynamicMediaFiles = req.files?.dynamicMedia || []

    let fileIndex = 0

    // 遍歷 features 和 specifications，將新上傳檔案的路徑填入
    const fillInFilePaths = (items) => {
      return items.map((item) => {
        // content 預期為一個陣列
        if (Array.isArray(item.content)) {
          const newContent = item.content.map((contentValue) => {
            // 如果是 placeholder，就從上傳的檔案中取一個路徑替換
            if (contentValue === '__HAS_FILE__') {
              const file = dynamicMediaFiles[fileIndex]
              if (file) {
                fileIndex++
                return file.path
              }
              throw new Error('動態檔案數量與內容不匹配')
            }
            // 否則，保留原來的值 (文字內容或既有的 URL)
            return contentValue
          })
          return { ...item, content: newContent }
        }
        // 如果 content 不是陣列 (例外情況)，直接返回原項目
        return item
      })
    }

    const processedFeatures = fillInFilePaths(features)
    const processedSpecifications = fillInFilePaths(specifications)

    const updateData = {
      name,
      price: parsedPrice,
      emotions,
      category,
      details,
      description,
      features: processedFeatures,
      specifications: processedSpecifications,
      sell: sell === 'true',
      roll: roll === 'true',
    }

    // --- 圖片更新邏輯 ---
    let finalImagePaths = []
    // 1. 處理保留的舊圖片
    if (existingImages) {
      finalImagePaths = JSON.parse(existingImages)
    }

    // 2. 處理新上傳的圖片
    if (req.files?.images?.length > 0) {
      const newImagePaths = req.files.images.map((file) => file.path)
      finalImagePaths.push(...newImagePaths)
    }

    // 3. 驗證與更新
    if (finalImagePaths.length === 0) {
      // 如果最終沒有任何圖片，回傳錯誤 (因為 images 和 image 欄位是必填)
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '至少需要一張商品圖片',
      })
    }

    updateData.images = finalImagePaths
    updateData.image = finalImagePaths[0] // 更新封面圖為最終列表的第一張

    console.log('最終圖片路徑:', finalImagePaths)
    console.log('最終封面圖路徑:', finalImagePaths[0])

    const product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })

    if (!product) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到商品',
      })
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: '商品更新成功',
      product,
    })
  } catch (error) {
    console.error('controllers/product.js update', error)
    if (error.name === 'SyntaxError') {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '動態內容資料格式錯誤',
      })
    } else if (error.message === '動態檔案數量與內容不匹配') {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '動態檔案數量與內容不匹配，請重新確認',
      })
    } else if (error.name === 'ValidationError') {
      const key = Object.keys(error.errors)[0]
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: error.errors[key].message,
      })
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '伺服器內部錯誤',
      })
    }
  }
}

export const getId = async (req, res) => {
  try {
    // 檢查商品 ID 是否有效
    if (!validator.isMongoId(req.params.id)) {
      throw new Error('PRODUCT ID')
    }

    const product = await Product.findById(req.params.id)
      .populate('seller', 'account')
      .orFail(new Error('PRODUCT NOT FOUND'))

    res.status(StatusCodes.OK).json({
      success: true,
      message: '商品取得成功',
      product,
    })
  } catch (error) {
    console.log('controllers/product.js getId')
    console.error(error)
    if (error.message === 'PRODUCT ID') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '無效的商品 ID',
      })
    } else if (error.message === 'PRODUCT NOT FOUND') {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '商品不存在',
      })
    } else {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '伺服器內部錯誤',
      })
    }
  }
}

export const getReviews = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.id)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '無效的商品 ID',
      })
    }

    const reviews = await Review.find({ productId: req.params.id }).populate('userId', 'account')

    res.status(StatusCodes.OK).json({
      success: true,
      message: '商品評論取得成功',
      result: reviews,
    })
  } catch (error) {
    console.error('controllers/product.js getReviews', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器內部錯誤',
    })
  }
}

export const addReview = async (req, res) => {
  try {
    const { rating, content } = req.body
    const productId = req.params.id

    if (!validator.isMongoId(productId)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '無效的商品 ID',
      })
    }

    const product = await Product.findById(productId)
    if (!product) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到商品',
      })
    }

    // 檢查用戶是否已經評論過該商品
    const existingReview = await Review.findOne({ userId: req.user._id, productId })
    if (existingReview) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '您已經評論過此商品',
      })
    }

    const review = new Review({
      userId: req.user._id,
      productId,
      rating,
      content,
    })

    await review.save()

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: '評論新增成功',
      result: review,
    })
  } catch (error) {
    console.error('controllers/product.js addReview', error)
    if (error.name === 'ValidationError') {
      const key = Object.keys(error.errors)[0]
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: error.errors[key].message,
      })
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '伺服器內部錯誤',
      })
    }
  }
}

export const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params
    const { rating, content } = req.body

    if (!validator.isMongoId(reviewId)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '無效的評論 ID',
      })
    }

    const review = await Review.findById(reviewId)

    if (!review) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到評論',
      })
    }

    if (review.userId.toString() !== req.user._id.toString()) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: '無權限修改此評論',
      })
    }

    review.rating = rating
    review.content = content
    await review.save()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '評論更新成功',
      result: review,
    })
  } catch (error) {
    console.error('controllers/product.js updateReview', error)
    if (error.name === 'ValidationError') {
      const key = Object.keys(error.errors)[0]
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: error.errors[key].message,
      })
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '伺服器內部錯誤',
      })
    }
  }
}

// 取得特定賣家的其他商品
export const getBySeller = async (req, res) => {
  try {
    console.log('getBySeller API 被呼叫')
    console.log('參數:', { sellerId: req.params.sellerId, exclude: req.query.exclude })

    const { sellerId } = req.params
    const { exclude } = req.query // 排除的商品 ID

    console.log('驗證賣家 ID')
    if (!validator.isMongoId(sellerId)) {
      console.log('無效的賣家 ID:', sellerId)
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '無效的賣家 ID',
      })
    }

    console.log('開始搜尋商品')
    // 建立基本查詢條件
    const pipeline = [
      {
        $match: {
          seller: new mongoose.Types.ObjectId(sellerId),
          sell: true,
        },
      },
    ]

    // 如果有 exclude 參數，加入排除條件
    if (exclude) {
      console.log('處理排除商品邏輯')
      // 增加對 exclude ID 的驗證
      if (!validator.isMongoId(exclude)) {
        console.log('無效的排除商品 ID:', exclude)
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '無效的排除商品 ID',
        })
      }
      pipeline[0].$match._id = { $ne: new mongoose.Types.ObjectId(exclude) }
    }

    console.log('執行聚合查詢，pipeline:', JSON.stringify(pipeline))
    const products = await Product.aggregate(pipeline).limit(10)

    console.log('查詢結果數量:', products.length)

    res.status(StatusCodes.OK).json({
      success: true,
      message: '成功取得賣家商品',
      result: products,
    })
  } catch (error) {
    console.error('controllers/product.js getBySeller 錯誤詳情:', error)
    // 檢查錯誤類型
    if (error.name === 'CastError') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '無效的 ID 格式',
      })
    }
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器內部錯誤: ' + error.message,
    })
  }
}

// 取得相關推薦商品
export const getRelated = async (req, res) => {
  try {
    const { productId } = req.params

    if (!validator.isMongoId(productId)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '無效的商品 ID',
      })
    }

    const originalProduct = await Product.findById(productId).lean()
    if (!originalProduct) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到原始商品',
      })
    }

    const products = await Product.aggregate([
      {
        $match: {
          category: originalProduct.category, // 相同分類
          sell: true, // 上架中
          _id: { $ne: originalProduct._id }, // 排除自己
        },
      },
      { $sample: { size: 10 } }, // 隨機取 10 筆
    ])

    res.status(StatusCodes.OK).json({
      success: true,
      message: '成功取得相關商品',
      result: products,
    })
  } catch (error) {
    console.error('controllers/product.js getRelated', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器內部錯誤',
    })
  }
}
