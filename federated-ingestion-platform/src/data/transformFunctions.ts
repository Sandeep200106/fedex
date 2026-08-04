import type { TransformFunction } from '../types'

export interface TransformFunctionSpec {
  label: string
  argLabels: string[]
}

export const TRANSFORM_FUNCTIONS: Record<TransformFunction, TransformFunctionSpec> = {
  TRIM: { label: 'TRIM — remove leading/trailing whitespace', argLabels: [] },
  UPPER: { label: 'UPPER — convert to uppercase', argLabels: [] },
  LOWER: { label: 'LOWER — convert to lowercase', argLabels: [] },
  ROUND: { label: 'ROUND — round a numeric value', argLabels: ['Decimal places'] },
  CAST: { label: 'CAST — convert to a different type', argLabels: ['Target type'] },
  RENAME: { label: 'RENAME — rename the column', argLabels: ['New column name'] },
  REPLACE: { label: 'REPLACE — substring replace', argLabels: ['Find', 'Replace with'] },
  COALESCE: { label: 'COALESCE — default value when null', argLabels: ['Default value'] },
}
