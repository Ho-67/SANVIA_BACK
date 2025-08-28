import DiceRoll from '../models/diceRoll.js'
import { Router } from 'express'
import * as auth from '../middlewares/auth.js'

const router = Router()

router.post('/', auth.token, async (req, res) => {
  try {
    // 檢查是否已經擲過骰子
    const existingRoll = await DiceRoll.findOne({
      product: req.body.productId,
      user: req.user._id,
    })

    if (existingRoll) {
      return res.status(400).send({ success: false, message: '已經擲過骰子' })
    }

    // 儲存新的擲骰結果
    const roll = await DiceRoll.create({
      product: req.body.productId,
      user: req.user._id,
      roll: req.body.roll,
      multiplier: req.body.multiplier,
    })

    res.status(200).send({ success: true, message: '', result: roll })
  } catch (error) {
    res.status(500).send({ success: false, message: '伺服器錯誤' })
  }
})

// 檢查使用者是否已經擲過骰子
router.get('/:productId', auth.token, async (req, res) => {
  try {
    const roll = await DiceRoll.findOne({
      product: req.params.productId,
      user: req.user._id,
    })

    if (!roll) {
      return res.status(404).send({ success: false, message: '尚未擲骰' })
    }

    res.status(200).send({ success: true, message: '', result: roll })
  } catch (error) {
    res.status(500).send({ success: false, message: '伺服器錯誤' })
  }
})

export default router
