// src/app/founders/layout.tsx
import type { Metadata } from "next";
import { founderJsonLd } from "@/lib/founderSchema";

const BASE_URL = "https://www.foodknock.com";

export const metadata: Metadata = {
    metadataBase: new URL(BASE_URL),
    title: "Our Founders — Meet the Team Behind FoodKnock",
    description:
        "Meet Manish Kumar and Gaurav Kumawat — the two co-founders of FoodKnock. Learn how their expertise in brand strategy, business operations, and technology built a premium online food ordering platform in Danta, Sikar, Rajasthan.",
    alternates: {
        canonical: `${BASE_URL}/founders`,
    },
    openGraph: {
        type: "website",
        url: `${BASE_URL}/founders`,
        siteName: "FoodKnock",
        title: "Our Founders — Meet the People Building FoodKnock",
        description:
            "Two founders. One vision. Meet Manish Kumar and Gaurav Kumawat — the people who built FoodKnock from the ground up in Danta, Rajasthan.",
        images: [
            {
                url: `${BASE_URL}/og-image.png`,
                width: 1200,
                height: 630,
                alt: "FoodKnock Founders - Manish Kumar and Gaurav Kumawat",
            },
        ],
        locale: "en_IN",
    },
    twitter: {
        card: "summary_large_image",
        title: "Our Founders — FoodKnock",
        description:
            "Meet Manish Kumar and Gaurav Kumawat — the two co-founders behind FoodKnock.",
        images: [`${BASE_URL}/og-image.png`],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
    keywords: [
        "FoodKnock founders",
        "FoodKnock co-founders",
        "Manish Kumar FoodKnock",
        "Gaurav Kumawat FoodKnock",
        "Manish Kumar founder",
        "Gaurav Kumawat founder",
        "FoodKnock leadership",
        "FoodKnock story",
        "FoodKnock team",
        "FoodKnock founders Rajasthan",
        "FoodKnock Danta Rajasthan",
        "food delivery startup founders Rajasthan",
        "FoodKnock Danta",
        "FoodKnock Sikar",
    ],
};

export default function FoundersLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(founderJsonLd) }}
            />
            {children}
        </>
    );
}
