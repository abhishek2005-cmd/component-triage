import mongoose from 'mongoose';

const { Schema } = mongoose;

const partSchema = new Schema(
  {
    partNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
    },
    keySpecs: {
      type: Map,
      of: Schema.Types.Mixed,
      default: () => new Map(),
    },
    package: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isFinite,
        message: 'Price must be a finite number',
      },
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Stock must be a non-negative integer',
      },
    },
    searchableText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },
  },
  {
    timestamps: true,
  },
);

const Part = mongoose.models.Part || mongoose.model('Part', partSchema);

export default Part;