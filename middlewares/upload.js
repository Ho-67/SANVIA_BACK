// 處理 multipart/form-data（表單含檔案上傳的格式）
import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
// 自動把上傳的檔案存到 cloudinary
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import { StatusCodes } from 'http-status-codes'

// 設定 cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// 上傳檔案設定
const upload = multer({
  // storage: 設定上傳目標是 Cloudinary
  storage: new CloudinaryStorage({
    cloudinary,
    params: {
      resource_type: 'auto',
    },
  }),
  // req = 請求資訊
  // file = 檔案資訊
  // callback(錯誤, 是否允許上傳)
  fileFilter(req, file, callback) {
    console.log('file.mimetype:', file.mimetype)
    if (
      [
        'image/jpeg',
        'image/png',
        'image/gif',
        'audio/mpeg', // MP3
        'audio/wav',
        'video/mp4',
      ].includes(file.mimetype)
    ) {
      callback(null, true)
    } else {
      callback(new Error('只允許上傳 JPEG、PNG、GIF、MP3、WAV、MP4 等格式'), false)
    }
  },
  limits: {
    fileSize: 20 * 1024 * 1024, // 最大 20MB
  },
})

// 接受多個欄位的檔案上傳
// upload.js
const uploader = upload.fields([
  { name: 'images', maxCount: 5 }, // 商品圖片(允許多張)
  { name: 'dynamicMedia', maxCount: 10 }, // 所有動態檔案
])

export default (req, res, next) => {
  uploader(req, res, (error) => {
    // 處理上傳檔案
    if (error) {
      console.error('上傳錯誤:', error)
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: error.message || '請上傳檔案',
      })
    }

    // 從 req.files 取得上傳的檔案，兩個欄位的檔案各取出（images、dynamicMedia）
    const allFiles = [...(req.files?.images || []), ...(req.files?.dynamicMedia || [])]
    // 計算總檔案大小
    const totalSize = allFiles.reduce((sum, file) => sum + file.size, 0)

    // 限制總大小為 20MB
    const maxTotalSize = 20 * 1024 * 1024
    if (totalSize > maxTotalSize) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '總檔案大小不可超過 20MB',
      })
    }

    console.log(
      '上傳成功:',
      // .map() 轉換陣列元素
      // originalname 是 multer 裡檔案物件的屬性之一，代表上傳時使用者的原始檔案名稱
      allFiles.map((el) => el.originalname),
    )

    // 這裡可以取得所有檔案，它們會被分別放在 req.files.images 和 req.files.dynamicMedia
    console.log('上傳的商品圖片:', req.files?.images)
    console.log('上傳的動態媒體:', req.files?.dynamicMedia)
    next()
  })
}
