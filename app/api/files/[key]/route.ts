import { readImage } from "@/lib/storage";

/** 提供本地上传目录（.data/uploads）或私有 S3 桶中图片的访问 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const file = await readImage(decodeURIComponent(key));
  if (!file) {
    return new Response("Not Found", { status: 404 });
  }
  return new Response(Buffer.from(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
