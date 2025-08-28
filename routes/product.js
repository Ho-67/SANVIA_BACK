import { Router } from 'express'
import * as auth from '../middlewares/auth.js'
import * as product from '../controllers/product.js'
import upload from '../middlewares/upload.js'

const router = Router()

router.get('/', product.get)
router.get('/all', auth.token, auth.seller, product.getAll)
router.get('/:id', product.getId)
router.get('/seller/:sellerId', product.getBySeller)
router.get('/related/:productId', product.getRelated)
router.post('/', auth.token, auth.seller, upload, product.create)
router.patch('/:id', auth.token, auth.seller, upload, product.update)
router.get('/:id/reviews', product.getReviews)
router.post('/:id/reviews', auth.token, product.addReview)
router.patch('/:id/reviews/:reviewId', auth.token, product.updateReview)

export default router