package com.accountease;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
public final class JwtService {
  private static final String SECRET = System.getenv("JWT_SECRET");
  private JwtService() {}
  public static String create(String ownerId,String username){ String body=ownerId+":"+username; return Base64.getUrlEncoder().withoutPadding().encodeToString(body.getBytes(StandardCharsets.UTF_8))+"."+sign(body); }
  public static String ownerId(String token){ try { String[] parts=token.split("\\."); String body=new String(Base64.getUrlDecoder().decode(parts[0]),StandardCharsets.UTF_8); if(!sign(body).equals(parts[1])) return null; return body.split(":",2)[0]; } catch(Exception e){ return null; } }
  private static String sign(String body){ try { Mac mac=Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8),"HmacSHA256")); return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(body.getBytes(StandardCharsets.UTF_8))); } catch(Exception e){ throw new IllegalStateException(e); } }
}