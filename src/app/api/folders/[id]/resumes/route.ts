import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { extractTextFromBuffer, validateFileSize, chunkText, embedAndStoreChunks } from '@/agents/ragAnalyst'
import { MAX_FILE_SIZE_BYTES } from '@/lib/constants'
import crypto from 'crypto'

// POST /api/folders/[id]/resumes — upload and attach a resume to a folder
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: folderId } = await params

  // Verify folder ownership
  const { data: folder, error: folderError } = await supabase
    .from('folders')
    .select('id')
    .eq('id', folderId)
    .eq('owner_id', user.id)
    .single()

  if (folderError || !folder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Validate file size
  try {
    validateFileSize(file.size)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only PDF and DOCX files are supported.' },
      { status: 400 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex')

  // Check for existing resume by hash (deduplication)
  const { data: existing } = await supabase
    .from('resumes')
    .select('id')
    .eq('file_hash', fileHash)
    .single()

  let resumeId: string

  if (existing) {
    resumeId = existing.id
  } else {
    // Extract text
    let parsed
    try {
      parsed = await extractTextFromBuffer(buffer, file.type)
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 })
    }

    // Upload to Supabase Storage
    const storagePath = `resumes/${user.id}/${fileHash}/${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(storagePath, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('resumes')
      .getPublicUrl(storagePath)

    // Insert resume record
    const { data: resume, error: insertError } = await supabase
      .from('resumes')
      .insert({
        file_hash: fileHash,
        file_name: file.name,
        file_url: publicUrl,
        file_size_bytes: file.size,
        page_count: parsed.pageCount,
        raw_text: parsed.text,
        uploaded_by: user.id,
      })
      .select('id')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    resumeId = resume.id

    // Embed chunks in background (non-blocking)
    const chunks = chunkText(parsed.text)
    embedAndStoreChunks(resumeId, chunks).catch(console.error)
  }

  // Link resume to folder
  const { error: linkError } = await supabase
    .from('folder_resumes')
    .upsert({ folder_id: folderId, resume_id: resumeId })

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 })
  }

  return NextResponse.json({ resumeId }, { status: 201 })
}

// GET /api/folders/[id]/resumes — list resumes in a folder
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: folderId } = await params

  const { data, error } = await supabase
    .from('folder_resumes')
    .select('added_at, resumes(id, file_name, file_url, page_count, created_at)')
    .eq('folder_id', folderId)
    .order('added_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
