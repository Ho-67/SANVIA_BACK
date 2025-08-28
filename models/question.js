import { Schema, model } from 'mongoose'

const schema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'products',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'users',
      required: true,
    },
    question: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'users',
      },
    ],
    dislikes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'users',
      },
    ],
    replyTo: {
      type: String,
      default: null,
    },
    replyToDisplay: {
      type: String,
      default: null,
    },
    floorNumber: {
      type: String,
      required: true,
      unique: true,
    },
    isSeller: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false, timestamps: true },
)

export default model('question', schema)
