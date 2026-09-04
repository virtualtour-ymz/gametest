import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, stations, topics } from "@/db/schema";
import { EmptyState, PageHeader } from "@/components/ui";
import ImportForm from "@/components/admin/ImportForm";

export const dynamic = "force-dynamic";

export default async function AdminImportPage() {
  const sts = await db
    .select({ id: stations.id, title: stations.title, topic: topics.title, category: categories.name })
    .from(stations)
    .innerJoin(topics, eq(topics.id, stations.topicId))
    .innerJoin(categories, eq(categories.id, topics.categoryId))
    .orderBy(asc(categories.sortOrder), asc(topics.sortOrder), asc(stations.sortOrder), asc(stations.id));
  return (
    <div className="animate-fade-up">
      <PageHeader title="ورود گروهی سؤال" subtitle="ده‌ها سؤال را یک‌جا با فرمت JSON وارد کنید. همهٔ ردیف‌ها قبل از ثبت اعتبارسنجی می‌شوند." />
      {sts.length === 0 ? (
        <EmptyState icon="🏗️" title="ابتدا یک ایستگاه بسازید" description="برای ورود سؤال باید حداقل یک ایستگاه وجود داشته باشد." action={{ href: "/admin/content", label: "مدیریت محتوا" }} />
      ) : (
        <ImportForm stations={sts} />
      )}
    </div>
  );
}
