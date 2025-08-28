import { Schema, model } from 'mongoose'

const schema = new Schema(
  {
    seller: {
      type: Schema.Types.ObjectId,
      ref: 'users',
      required: [true, '缺少賣家資訊'],
    },
    name: {
      type: String,
      required: [true, '商品名稱必填'],
      trim: true,
      minlength: [1, '商品名稱至少1個字'],
      maxlength: [50, '商品名稱最多50個字'],
    },
    price: {
      type: Number,
      required: [true, '情緒價值必填'],
      min: [0, '情緒價值不得為負數'],
      max: [999999999, '情緒價值最高為999,999,999'],
    },
    emotions: {
      type: String,
      required: [true, '情緒分類必填'],
      enum: ['正面', '中立', '負面', '其他'],
    },
    category: {
      type: String,
      required: [true, '商品類別必填'],
      enum: ['文字', '圖片', '音樂', '語音', '影片', '物品', '其他'],
    },
    details: {
      type: String,
      trim: true,
      maxlength: [20, '細項說明最多20字'],
    },
    images: {
      type: [String],
      required: [true, '至少需要一張商品圖片'],
      validate: [
        {
          validator: function (v) {
            return v.length > 0
          },
          message: '至少需要一張商品圖片',
        },
        {
          validator: function (v) {
            return v.length <= 5
          },
          message: '最多只能上傳5張圖片',
        },
      ],
    },
    // 第一張圖片作為封面圖
    image: {
      type: String,
      required: [true, '商品封面圖必填'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, '商品簡介最多200字'],
      required: true,
    },

    // 商品特色
    features: [
      {
        type: {
          type: String,
          enum: ['文字說明', '圖片說明', '影音說明'],
        },
        content: {
          type: String, // 內容本身，可以是文字或圖片/影片 URL
        },
      },
    ],
    // 商品規格
    specifications: [
      {
        type: {
          type: String,
          enum: ['文字說明', '圖片說明'],
        },
        content: {
          type: String,
        },
      },
    ],
    sell: {
      type: Boolean,
      default: true,
      required: [true, '是否上架必填'],
    },
    roll: {
      type: Boolean,
      default: false,
      required: [true, '是否開放擲骰必填'],
    },
  },
  { versionKey: false, timestamps: true },
)

export default model('product', schema)
