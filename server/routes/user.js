import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { getSupabaseAdmin } from '../db/supabase.js'
import { authenticateToken, upload } from '../middleware/index.js'
import { logger } from '../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Get user documents
router.get('/documents', authenticateToken, async (req, res) => {
  logger.debug('GET /api/user/documents - Request received')
  try {
    const supabase = getSupabaseAdmin()
    const { data: documents, error } = await supabase
      .from('user_documents')
      .select('document_type, file_path, file_name, file_size, uploaded_at')
      .eq('user_id', req.user.id)
    
    if (error) {
      throw error
    }
    
    res.json(documents || [])
  } catch (error) {
    logger.error('Error fetching user documents', error)
    res.status(500).json({ error: 'Failed to fetch user documents' })
  }
})

// Upload user document
router.post('/documents/:type', authenticateToken, upload.single('file'), async (req, res) => {
  logger.debug(`POST /api/user/documents/${req.params.type} - Request received`)
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const { type } = req.params
    if (!['picture', 'diploma', 'passport'].includes(type)) {
      // Delete uploaded file if invalid type
      const filePath = path.join(__dirname, '..', 'uploads', req.user.id, req.file.filename)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
      return res.status(400).json({ error: 'Invalid document type' })
    }

    const supabase = getSupabaseAdmin()

    // Store file path as userId/filename for consistency
    // req.file.filename is the sanitized version of the renamed file from frontend
    const filePath = `${req.user.id}/${req.file.filename}`
    
    // Check if document already exists
    const { data: existing } = await supabase
      .from('user_documents')
      .select('file_path')
      .eq('user_id', req.user.id)
      .eq('document_type', type)
      .single()
    
    if (existing) {
      // Delete old file
      const oldFilePath = path.join(__dirname, '..', 'uploads', existing.file_path)
      if (fs.existsSync(oldFilePath)) {
        try {
          fs.unlinkSync(oldFilePath)
        } catch (unlinkError) {
          logger.error('Error deleting old file', unlinkError)
          // Continue even if old file deletion fails
        }
      }
      // Update existing
      const { error: updateError } = await supabase
        .from('user_documents')
        .update({
          file_path: filePath,
          file_name: req.file.originalname,
          file_size: req.file.size
        })
        .eq('user_id', req.user.id)
        .eq('document_type', type)
      
      if (updateError) {
        throw updateError
      }
    } else {
      // Insert new
      const { error: insertError } = await supabase
        .from('user_documents')
        .insert({
          user_id: req.user.id,
          document_type: type,
          file_path: filePath,
          file_name: req.file.originalname,
          file_size: req.file.size
        })
      
      if (insertError) {
        throw insertError
      }
    }

    res.json({ 
      message: 'Document uploaded successfully',
      document: {
        document_type: type,
        file_path: filePath,
        file_name: req.file.originalname,
        file_size: req.file.size,
        uploaded_at: new Date().toISOString()
      }
    })
  } catch (error) {
    logger.error('Error uploading document', error)
    // Clean up uploaded file on error
    if (req.file) {
      const filePath = path.join(__dirname, '..', 'uploads', req.user.id, req.file.filename)
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath)
        } catch (unlinkError) {
          logger.error('Error cleaning up file', unlinkError)
        }
      }
    }
    res.status(500).json({ error: 'Failed to upload document' })
  }
})

// Get user details
router.get('/details', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin()
    const { data: details, error } = await supabase
      .from('user_details')
      .select('*')
      .eq('user_id', req.user.id)
      .single()
    
    // Return null if no details found (not an error)
    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      throw error
    }
    
    if (!details) {
      return res.json(null)
    }
    res.json(details)
  } catch (error) {
    logger.error('Error fetching user details', error)
    res.status(500).json({ error: 'Failed to fetch user details' })
  }
})

// Save user details
router.post('/details', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin()
    const {
      first_name, middle_name, last_name, mobile_number, email, gender, marital_status, single_full_name,
      date_of_birth, birth_place,
      house_number, street_name, city, province, country, zipcode,
      elementary_school, elementary_city, elementary_province, elementary_country,
      elementary_years_attended, elementary_start_date, elementary_end_date,
      high_school, high_school_city, high_school_province, high_school_country,
      high_school_years_attended, high_school_start_date, high_school_end_date,
      high_school_graduated, high_school_diploma_type, high_school_diploma_date,
      nursing_school, nursing_school_city, nursing_school_province, nursing_school_country,
      nursing_school_years_attended, nursing_school_start_date, nursing_school_end_date,
      nursing_school_major, nursing_school_diploma_date,
      signature, payment_type
    } = req.body

    // Check if details exist
    const { data: existing } = await supabase
      .from('user_details')
      .select('user_id')
      .eq('user_id', req.user.id)
      .single()

    // Update first_name and last_name in users table if changed
    if (first_name || last_name) {
      const updateUserData = {}
      if (first_name) updateUserData.first_name = first_name
      if (last_name) updateUserData.last_name = last_name
      
      if (Object.keys(updateUserData).length > 0) {
        await supabase
          .from('users')
          .update(updateUserData)
          .eq('id', req.user.id)
      }
    }

    // Build update/insert data object
    const userDetailsData = {
      user_id: req.user.id,
      first_name: first_name || null,
      middle_name: middle_name || null,
      last_name: last_name || null,
      mobile_number: mobile_number || null,
      email: email || null,
      gender: gender || null,
      marital_status: marital_status || null,
      single_full_name: marital_status === 'single' ? (single_full_name || null) : null,
      date_of_birth: date_of_birth || null,
      birth_place: birth_place || null,
      house_number: house_number || null,
      street_name: street_name || null,
      city: city || null,
      province: province || null,
      country: country || null,
      zipcode: zipcode || null,
      elementary_school: elementary_school || null,
      elementary_city: elementary_city || null,
      elementary_province: elementary_province || null,
      elementary_country: elementary_country || null,
      elementary_years_attended: elementary_years_attended || null,
      elementary_start_date: elementary_start_date || null,
      elementary_end_date: elementary_end_date || null,
      high_school: high_school || null,
      high_school_city: high_school_city || null,
      high_school_province: high_school_province || null,
      high_school_country: high_school_country || null,
      high_school_years_attended: high_school_years_attended || null,
      high_school_start_date: high_school_start_date || null,
      high_school_end_date: high_school_end_date || null,
      high_school_graduated: high_school_graduated || null,
      high_school_diploma_type: high_school_diploma_type || null,
      high_school_diploma_date: high_school_diploma_date || null,
      nursing_school: nursing_school || null,
      nursing_school_city: nursing_school_city || null,
      nursing_school_province: nursing_school_province || null,
      nursing_school_country: nursing_school_country || null,
      nursing_school_years_attended: nursing_school_years_attended || null,
      nursing_school_start_date: nursing_school_start_date || null,
      nursing_school_end_date: nursing_school_end_date || null,
      nursing_school_major: nursing_school_major || null,
      nursing_school_diploma_date: nursing_school_diploma_date || null,
      signature: signature || null,
      payment_type: payment_type || null
    }

    if (existing) {
      // Update existing
      const { error: updateError } = await supabase
        .from('user_details')
        .update(userDetailsData)
        .eq('user_id', req.user.id)
      
      if (updateError) {
        throw updateError
      }
    } else {
      // Insert new
      const { error: insertError } = await supabase
        .from('user_details')
        .insert(userDetailsData)
      
      if (insertError) {
        throw insertError
      }
    }

    res.json({ message: 'User details saved successfully' })
  } catch (error) {
    logger.error('Error saving user details', error)
    res.status(500).json({ 
      error: 'Failed to save user details',
      details: error.message || 'Unknown error'
    })
  }
})

export default router


