
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const type = searchParams.get('type') || 'platform';
    const title = searchParams.get('title') || 'Viby';
    const subtitle = searchParams.get('subtitle') || 'Experiências memoráveis';
    const category = searchParams.get('category');
    const image = searchParams.get('image');
    const avatar = searchParams.get('avatar');
    const name = searchParams.get('name');
    const username = searchParams.get('username');

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000',
            backgroundImage: 'linear-gradient(to bottom right, #000000, #0a0a0a)',
            fontFamily: 'sans-serif',
            position: 'relative',
          }}
        >
          {/* Background Image with Blur/Overlay */}
          {image && (
            <img
              src={image}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.4,
              }}
            />
          )}

          {/* Gradients */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.8) 100%)',
            }}
          />

          {/* Platform Branding */}
          <div
            style={{
              position: 'absolute',
              top: 40,
              left: 50,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                backgroundColor: '#0070f3',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                fontWeight: 'bold',
                color: '#fff',
                fontStyle: 'italic',
              }}
            >
              V
            </div>
            <span style={{ color: '#fff', fontSize: 24, fontWeight: 900, letterSpacing: -1, textTransform: 'uppercase', fontStyle: 'italic' }}>
              Viby
            </span>
          </div>

          {/* Content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '0 60px',
              width: '100%',
              zIndex: 10,
              marginTop: 60,
            }}
          >
            {category && (
              <div
                style={{
                  display: 'flex',
                  padding: '4px 16px',
                  backgroundColor: '#0070f3',
                  borderRadius: 20,
                  width: 'fit-content',
                  marginBottom: 20,
                }}
              >
                <span style={{ color: '#fff', fontSize: 18, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 2 }}>
                  {category}
                </span>
              </div>
            )}

            <h1
              style={{
                fontSize: 72,
                fontWeight: 900,
                color: '#fff',
                margin: 0,
                letterSpacing: -3,
                lineHeight: 1,
                textTransform: 'uppercase',
                fontStyle: 'italic',
                maxWidth: '900px',
              }}
            >
              {title}
            </h1>

            {subtitle && (
              <p
                style={{
                  fontSize: 32,
                  color: 'rgba(255, 255, 255, 0.7)',
                  margin: '20px 0 0 0',
                  fontWeight: 500,
                }}
              >
                {subtitle}
              </p>
            )}

            {/* Profile Specific */}
            {type === 'profile' && avatar && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 40 }}>
                <img
                  src={avatar}
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    border: '4px solid #fff',
                    objectFit: 'cover',
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: '#fff', fontSize: 32, fontWeight: 800 }}>{name}</span>
                  <span style={{ color: '#0070f3', fontSize: 20, fontWeight: 700 }}>@{username}</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Decoration */}
          <div
            style={{
              position: 'absolute',
              bottom: 40,
              left: 50,
              right: 50,
              height: 1,
              backgroundColor: 'rgba(255,255,255,0.1)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 15,
              right: 50,
              color: 'rgba(255,255,255,0.3)',
              fontSize: 12,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            viby.club
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    return new Response(`Failed to generate image`, { status: 500 });
  }
}
