import { cookies } from "next/headers";

export async function POST(request) {
  try {
    const { password } = await request.json();
    const validPassword = process.env.APP_PASSWORD;

    if (!validPassword) {
      return Response.json(
        { error: "App password not configured on the server." },
        { status: 500 }
      );
    }

    if (password === validPassword) {
      // Set the auth token cookie securely.
      // 30 days expiration for convenience
      (await cookies()).set("auth_token", password, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, 
        path: "/",
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: "Invalid password" }, { status: 401 });
  } catch (err) {
    return Response.json({ error: "Authentication failed" }, { status: 500 });
  }
}
