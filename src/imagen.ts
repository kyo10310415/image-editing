import { PredictionServiceClient } from '@google-cloud/aiplatform';
import { google } from '@google-cloud/aiplatform/build/protos/protos';

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

  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentials) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set');
  }

  try {
    // クライアントの初期化
    const client = new PredictionServiceClient({
      apiEndpoint: `${location}-aiplatform.googleapis.com`,
    });

    const endpoint = `projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-001`;

    // リクエストパラメータの構築
    const instances: any[] = [
      {
        prompt: prompt,
      },
    ];

    // 参照画像がある場合は追加（編集モード）
    if (imageUrl) {
      // Data URLからBase64部分を抽出
      const base64Match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
      if (base64Match) {
        instances[0].image = {
          bytesBase64Encoded: base64Match[1],
        };
      }
    }

    const parameters = {
      sampleCount: 1,
      aspectRatio: aspectRatio,
      language: 'ja',
      safetyFilterLevel: 'block_some',
      personGeneration: 'allow_adult',
    };

    const request = {
      endpoint,
      instances: instances.map(i => ({ structValue: google.protobuf.Struct.fromObject(i) })),
      parameters: google.protobuf.Struct.fromObject(parameters),
    };

    console.log('Calling Vertex AI Imagen API...');
    const [response] = await client.predict(request);
    
    if (response.predictions && response.predictions.length > 0) {
      const prediction = response.predictions[0];
      
      // structValue から実際の値を取得
      const predictionObj = prediction.structValue?.fields;
      if (predictionObj && predictionObj.bytesBase64Encoded) {
        const imageData = predictionObj.bytesBase64Encoded.stringValue;
        
        // 画像データをデータURLとして返す
        return `data:image/png;base64,${imageData}`;
      }
    }
    
    throw new Error('No image generated from Imagen API');
  } catch (error: any) {
    console.error('Imagen API error:', error);
    if (error.message) {
      console.error('Error message:', error.message);
    }
    if (error.code) {
      console.error('Error code:', error.code);
    }
    throw new Error(`Imagen API failed: ${error.message || 'Unknown error'}`);
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
