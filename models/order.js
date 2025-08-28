import { Schema, model } from 'mongoose'

// 定義購物車內的商品結構
const cartSchema = new Schema(
  {
    product: {
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
    multiplier: { // 新增 multiplier 欄位
      type: Number,
      default: 1, // 預設值為 1，表示沒有擲骰或乘數為 1
    },
  },
  { versionKey: false, timestamps: true },
)

// 定義訂單的主結構
const schema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'users',
      required: [true, '缺少使用者ID'],
    },
    cart: {
      type: [cartSchema],
    },
    totalPrice: {
      type: Number,
      required: [true, '訂單總價必填'],
      min: [0, '訂單總價不能為負'],
    },
  },
  { versionKey: false, timestamps: true },
)

export default model('orders', schema)
