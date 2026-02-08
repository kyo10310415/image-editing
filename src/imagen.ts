import { PredictionServiceClient } from '@google-cloud/aiplatform';
import * as fs from 'fs';

// Vertex AI クライアントの初期化
const projectId = process.env.GOOGLE_CLOUD_PROJECT || '';
const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

interface GenerateImageParams {
  prompt: string;
  imageUrl?: string;
  aspectRatio?: string;
}

export async function generateImageWithImagen(params: GenerateImageParams): Promise<string> {
  const { prompt, imageUrl, aspectRatio = '16:9' } = params;

  // 必須環境変数の確認
  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT environment variable is not set');
  }

  // Render環境でのシークレットファイルパス処理
  let credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  
  if (!credentials) {
    credentials = './gcp-key.json';
  }
  
  // 環境変数から直接JSON文字列を読み込む方法もサポート
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const keyContent = Buffer.from(
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
      'base64'
    ).toString('utf-8');
    
    const tmpPath = '/tmp/gcp-key.json';
    fs.writeFileSync(tmpPath, keyContent);
    credentials = tmpPath;
  }

  try {
    // クライアントの初期化
    const client = new PredictionServiceClient({
      apiEndpoint: `${location}-aiplatform.googleapis.com`,
    });

    const endpoint = `projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-001`;

    // Vertex AI Imagen 3 API の正しいリクエスト形式
    // 参考: https://cloud.google.com/vertex-ai/generative-ai/docs/image/generate-images
    const instance = {
      prompt: prompt,
    };

    // 参照画像がある場合は追加（編集モード）
    if (imageUrl) {
      // Data URLからBase64部分を抽出
      const base64Match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
      if (base64Match) {
        (instance as any).image = {
          bytesBase64Encoded: base64Match[1],
        };
      }
    }

    const parameters = {
      sampleCount: 1,
      // aspectRatio は "16:9" のような文字列形式
      aspectRatio: aspectRatio,
      // 言語は "ja" または "en"
      language: 'ja',
      // セーフティフィルター
      safetyFilterLevel: 'block_some',
      // 人物生成の設定
      personGeneration: 'allow_adult',
    };

    // API仕様に従ったリクエスト構造
    const request = {
      endpoint: endpoint,
      instances: [instance],
      parameters: parameters,
    };

    console.log('Calling Vertex AI Imagen API...');
    console.log('Endpoint:', endpoint);
    console.log('Prompt length:', prompt.length);
    console.log('Aspect ratio:', aspectRatio);
    
    const [response] = await client.predict(request as any);
    
    console.log('Response received from Vertex AI');
    
    if (response.predictions && response.predictions.length > 0) {
      const prediction = response.predictions[0];
      
      // レスポンスから画像データを取得
      let imageData: string | undefined;
      
      // 複数のフォーマットを試す
      if (prediction.structValue?.fields?.bytesBase64Encoded) {
        imageData = prediction.structValue.fields.bytesBase64Encoded.stringValue;
        console.log('Image data extracted from structValue');
      }
      else if ((prediction as any).bytesBase64Encoded) {
        imageData = (prediction as any).bytesBase64Encoded;
        console.log('Image data extracted directly');
      }
      
      if (imageData) {
        console.log('Image generated successfully, data length:', imageData.length);
        // 画像データをデータURLとして返す
        return `data:image/png;base64,${imageData}`;
      }
    }
    
    console.error('No image data in response');
    throw new Error('No image generated from Imagen API');
  } catch (error: any) {
    console.error('Imagen API error:', error);
    
    // 詳細なエラー情報をログ
    if (error.message) {
      console.error('Error message:', error.message);
    }
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.details) {
      console.error('Error details:', error.details);
    }
    if (error.metadata) {
      console.error('Error metadata:', error.metadata);
    }
    
    // より詳細なエラーメッセージを返す
    const errorMsg = error.details || error.message || 'Unknown error';
    throw new Error(`Imagen API failed: ${errorMsg} (code: ${error.code || 'unknown'})`);
  }
}

// 画像URLからBase64データを取得
async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString('base64');
  } catch (error) {
    console.error('Error fetching image:', error);
    throw error;
  }
}
