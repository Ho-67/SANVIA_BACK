import User from '../models/user.js'
import Order from '../models/order.js'
import DiceRoll from '../models/diceRoll.js' // 引入 DiceRoll 模型
import { StatusCodes } from 'http-status-codes'

export const create = async (req, res) => {
  try {
    // 檢查購物車有沒有東西
    if (req.user.cart.length === 0) throw new Error('購物車為空')

    // 檢查購物車有沒有下架商品
    const populatedUser = await User.findById(req.user._id, 'cart').populate('cart.product', 'sell')
    const hasUnSell = populatedUser.cart.some((item) => !item.product.sell)
    if (hasUnSell) throw new Error('購物車有下架商品')

    // 處理購物車商品，加入 multiplier
    const orderCart = await Promise.all(req.user.cart.map(async (item) => {
      const product = await populatedUser.cart.find(p => p.product._id.toString() === item.product.toString())?.product;

      let multiplier = 1; // 預設乘數為 1
      if (product && product.roll) { // 如果商品開放擲骰
        const diceRoll = await DiceRoll.findOne({ product: item.product, user: req.user._id });
        if (diceRoll) {
          multiplier = diceRoll.multiplier;
        }
      }
      return {
        product: item.product,
        quantity: item.quantity,
        multiplier: multiplier,
      };
    }));

    // 建立訂單
    await Order.create({
      user: req.user._id,
      cart: orderCart, // 使用處理後的購物車資料
      totalPrice: req.body.totalPrice, // 新增總價
    })

    // 清空購物車
    req.user.cart = []
    await req.user.save()

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: '訂單建立成功',
    })
  } catch (error) {
    console.error(error)
    if (error.message === '購物車為空') {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '購物車為空',
      })
    } else if (error.message === '購物車有下架商品') {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '購物車有下架商品',
      })
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '伺服器內部錯誤',
      })
    }
  }
}

export const getMy = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('user', 'account')
      .populate('cart.product')
      .sort({ createdAt: -1 })

    

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: orders,
    })
  } catch (error) {
    console.error(error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器內部錯誤',
    })
  }
}

export const getAll = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'account')
      .populate('cart.product')
      .sort({ createdAt: -1 })

    res.status(StatusCodes.OK).json({
      success: true,
      message: '',
      result: orders,
    })
  } catch (error) {
    console.error(error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器內部錯誤',
    })
  }
}
