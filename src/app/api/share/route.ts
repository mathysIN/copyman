
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const title = formData.get('title');
    const text = formData.get('text');
    const url = formData.get('url');
    const files = formData.getAll('file');

    console.log('Received share data:', { title, text, url, files });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing share data:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
