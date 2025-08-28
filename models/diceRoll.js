import { Schema, model } from 'mongoose'

const schema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'product',
      required: [true, '缺少商品資訊'],
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'users',
      required: [true, '缺少使用者資訊'],
    },
    roll: {
      type: Number,
      required: [true, '缺少擲骰結果'],
      min: 1,
      max: 20,
    },
    multiplier: {
      type: Number,
      required: [true, '缺少價格乘數'],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

// 確保每個使用者對每個商品只能擲一次骰子
schema.index({ product: 1, user: 1 }, { unique: true })

export default model('diceRolls', schema)
