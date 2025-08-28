import express from 'express'
import { create, getByProduct, likeQuestion, dislikeQuestion } from '../controllers/question.js'
import * as auth from '../middlewares/auth.js'

const router = express.Router()

router.post('/', auth.token, create)
router.get('/product/:id', getByProduct)

router.patch('/like/:id', auth.token, likeQuestion)
router.patch('/dislike/:id', auth.token, dislikeQuestion)

export default router
