import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        ...where,
        isRead: false,
      },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error("GET Notifications Error:", error);
    return NextResponse.json({ error: "Failed to fetch notifications." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { notificationId, markAllRead, userId } = body;

    if (markAllRead && userId) {
      await prisma.notification.updateMany({
        where: { userId },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true, message: "All marked as read." });
    }

    if (notificationId) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  } catch (error) {
    console.error("PATCH Notifications Error:", error);
    return NextResponse.json({ error: "Failed to update notifications." }, { status: 500 });
  }
}
