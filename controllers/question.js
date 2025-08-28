import Question from '../models/question.js'
import Product from '../models/product.js'
import mongoose from 'mongoose'

export const create = async (req, res) => {
  try {
    const { product, content, replyTo } = req.body // replyTo is the display target, e.g., 'B1-1'

    const productDoc = await Product.findById(product)
    if (!productDoc) {
      return res.status(404).json({ success: false, message: '找不到商品' })
    }
    const isSeller = productDoc.seller.toString() === req.user._id.toString()

    let floorNumber
    let functionalReplyTo = null // The real parent for nesting, e.g., 'B1'
    let displayReplyTo = null // The target for display, e.g., 'B1-1'

    if (replyTo) {
      // The original replyTo from frontend is for display
      displayReplyTo = replyTo

      // Find the root-level parent for functional nesting
      const rootReplyTo = replyTo.split('-')[0]
      functionalReplyTo = rootReplyTo

      // Check if the root parent comment exists
      const parentQuestion = await Question.findOne({ floorNumber: rootReplyTo, productId: product })
      if (!parentQuestion) {
        return res.status(404).json({ success: false, message: '回覆的留言不存在' })
      }

      // Count existing replies to the ROOT parent to generate the new floor number
      const replyCount = await Question.countDocuments({ replyTo: rootReplyTo, productId: product })
      floorNumber = `${rootReplyTo}-${replyCount + 1}`
    } else {
      // This is a top-level question
      const topLevelQuestions = await Question.find({ productId: product, replyTo: null }, 'floorNumber')
      let maxFloor = 0
      topLevelQuestions.forEach(q => {
        const num = parseInt(q.floorNumber.replace('B', ''), 10)
        if (num > maxFloor) {
          maxFloor = num
        }
      })
      floorNumber = `B${maxFloor + 1}`
    }

    const result = await Question.create({
      productId: product,
      userId: req.user._id,
      question: content,
      replyTo: functionalReplyTo, // Functional parent
      replyToDisplay: displayReplyTo, // Display parent
      isSeller,
      floorNumber,
    })

    await result.populate('userId', 'account')

    res.status(200).json({
      success: true,
      message: '',
      result,
    })
  } catch (error) {
    console.error(error)
    if (error.code === 11000) {
      return res.status(500).json({ success: false, message: '產生樓層編號時發生衝突，請重試' })
    }
    res.status(500).json({
      success: false,
      message: '提問失敗',
    })
  }
}

export const getByProduct = async (req, res) => {
  try {
    const { id: productId } = req.params

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: '無效的商品 ID' })
    }

    const allQuestions = await Question.find({ productId: productId })
      .populate('userId', 'account')
      .sort({ createdAt: 1 })

    const result = allQuestions.map(q => {
      const obj = q.toObject()
      // For the frontend, prioritize the display field, but fall back to the functional field.
      obj.replyToFloor = obj.replyToDisplay || obj.replyTo
      return obj
    })

    return res.status(200).json({
      success: true,
      message: '',
      result,
    })
  } catch (error) {
    console.error('取得提問時發生錯誤:', error)
    return res.status(500).json({
      success: false,
      message: '取得提問失敗',
      error: error.message,
    })
  }
}

const updateLikeDislike = async (req, res, type) => {
  try {
    const { id } = req.params
    const userId = req.user._id

    const question = await Question.findById(id)
    if (!question) {
      return res.status(404).json({ success: false, message: '找不到留言' })
    }

    if (type === 'like') {
      if (question.likes.includes(userId)) {
        question.likes.pull(userId)
      } else {
        question.likes.push(userId)
        question.dislikes.pull(userId)
      }
    } else if (type === 'dislike') {
      if (question.dislikes.includes(userId)) {
        question.dislikes.pull(userId)
      } else {
        question.dislikes.push(userId)
        question.likes.pull(userId)
      }
    }

    await question.save()

    res.status(200).json({
      success: true,
      message: '',
      result: {
        likesCount: question.likes.length,
        dislikesCount: question.dislikes.length,
        userLiked: question.likes.includes(userId),
        userDisliked: question.dislikes.includes(userId),
      },
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: '操作失敗' })
  }
}

export const likeQuestion = (req, res) => updateLikeDislike(req, res, 'like')
export const dislikeQuestion = (req, res) => updateLikeDislike(req, res, 'dislike')
