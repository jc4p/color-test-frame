import Image from "next/image";
import styles from "./page.module.css";
import { HomeComponent } from '@/components/HomeComponent';

export async function generateMetadata({ searchParams }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const r2PublicUrl = process.env.R2_PUBLIC_URL;
  const R2_FOLDER_PREFIX = 'true-colors-test/';

  let dynamicImageUrl = "https://cover-art.kasra.codes/true_color_rectangle.png";
  
  const shareImageFileNameOnly = (await searchParams).image; 

  if (shareImageFileNameOnly && r2PublicUrl) {
    const base = r2PublicUrl.endsWith('/') ? r2PublicUrl : `${r2PublicUrl}/`;
    // Prepend the folder prefix to the filename from the query parameter
    const fullImageIdentifier = `${R2_FOLDER_PREFIX}${shareImageFileNameOnly}`;
    dynamicImageUrl = `${base}${fullImageIdentifier}`;
    console.log(`Using dynamic image for frame: ${dynamicImageUrl}`);
  } else if (shareImageFileNameOnly && !r2PublicUrl) {
    console.warn("R2_PUBLIC_URL is not set, cannot use dynamic image for fc:frame.");
  }

  return {
    title: 'True Colors',
    description: 'Discover your True Colors personality type with True Colors.',
    other: {
      'fc:frame': JSON.stringify({
        version: "next",
        imageUrl: dynamicImageUrl,
        button: {
          title: "Find Your Color!",
          action: {
            type: "launch_frame",
            name: "true-color-test",
            url: appUrl,
            splashImageUrl: "https://cover-art.kasra.codes/true_color_icon.png",
            splashBackgroundColor: "#ffffff"
          }
        }
      })
    },
    openGraph: {
      title: 'True Colors',
      description: 'Discover your True Colors personality type with True Colors.',
      images: [
        {
          url: dynamicImageUrl,
          width: 600,
          height: 400,
          alt: 'True Colors',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'True Colors',
      description: 'Discover your True Colors personality type with True Colors.',
      images: [dynamicImageUrl],
    },
  };
}

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <HomeComponent />
      </main>
    </div>
  );
}
