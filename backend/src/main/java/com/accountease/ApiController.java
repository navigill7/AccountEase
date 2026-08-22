package com.accountease;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class ApiController {
  private final JdbcTemplate db;
  private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();
  public ApiController(JdbcTemplate db) { this.db = db; }

  @PostMapping("/auth/login")
  public Map<String, String> login(@RequestBody LoginRequest request) {
    var owners = db.query("SELECT id, username, password, name FROM owners WHERE username=?", (rs, n) -> Map.of("id", rs.getLong("id"), "username", rs.getString("username"), "password", rs.getString("password"), "name", rs.getString("name")), request.username());
    if (owners.isEmpty() || !passwords.matches(request.password(), owners.get(0).get("password").toString())) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
    var owner = owners.get(0);
    return Map.of("token", JwtService.create(owner.get("id").toString(), owner.get("username").toString()), "username", owner.get("username").toString(), "name", owner.get("name").toString());
  }

  @GetMapping("/organizations")
  public List<Map<String, Object>> organizations(@RequestAttribute("ownerId") Long ownerId, @RequestParam(defaultValue = "") String search) {
    return db.query("SELECT o.id,o.name,o.address,COUNT(c.id) AS customers FROM organizations o LEFT JOIN customers c ON c.organization_id=o.id WHERE o.owner_id=? AND LOWER(o.name) LIKE LOWER(?) GROUP BY o.id ORDER BY o.name", (rs, n) -> Map.of("id", rs.getLong("id"), "name", rs.getString("name"), "address", rs.getString("address") == null ? "" : rs.getString("address"), "customers", rs.getLong("customers")), ownerId, "%" + search + "%");
  }

  @PostMapping("/organizations") @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> createOrganization(@RequestAttribute("ownerId") Long ownerId, @RequestBody OrganizationRequest request) { db.update("INSERT INTO organizations(name,address,owner_id) VALUES(?,?,?)", request.name(), request.address(), ownerId); return organizations(ownerId, "").get(organizations(ownerId, "").size() - 1); }

  @GetMapping("/organizations/{organizationId}/customers")
  public List<Map<String,Object>> customers(@RequestAttribute("ownerId") Long ownerId, @PathVariable Long organizationId, @RequestParam(defaultValue = "") String search) { verifyOrganization(ownerId, organizationId); return db.query("SELECT c.id,c.name,c.mobile_number,c.father_name,c.address,COALESCE((SELECT balance FROM transactions t WHERE t.customer_id=c.id ORDER BY t.transaction_date DESC,t.id DESC LIMIT 1),0) balance FROM customers c WHERE c.organization_id=? AND (LOWER(c.name) LIKE LOWER(?) OR c.mobile_number LIKE ?) ORDER BY c.name", (rs,n) -> Map.of("id",rs.getLong("id"),"name",rs.getString("name"),"mobile",rs.getString("mobile_number"),"father",rs.getString("father_name"),"address",rs.getString("address"),"balance",rs.getBigDecimal("balance")), organizationId, "%"+search+"%", "%"+search+"%"); }

  @PostMapping("/organizations/{organizationId}/customers") @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> createCustomer(@RequestAttribute("ownerId") Long ownerId, @PathVariable Long organizationId, @RequestBody CustomerRequest request) { verifyOrganization(ownerId, organizationId); db.update("INSERT INTO customers(organization_id,name,mobile_number,father_name,address) VALUES(?,?,?,?,?)", organizationId,request.name(),request.mobileNumber(),request.fatherName(),request.address()); return Map.of("name",request.name(),"mobile",request.mobileNumber()); }

  @GetMapping("/customers/{customerId}/transactions")
  public List<Map<String,Object>> transactions(@RequestAttribute("ownerId") Long ownerId, @PathVariable Long customerId, @RequestParam(required=false) LocalDate from, @RequestParam(required=false) LocalDate to) { verifyCustomer(ownerId,customerId); return db.query("SELECT id,transaction_date,item,quantity,rate,amount,balance FROM transactions WHERE customer_id=? AND (? IS NULL OR transaction_date>=?) AND (? IS NULL OR transaction_date<=?) ORDER BY transaction_date DESC,id DESC", (rs,n)->Map.of("id",rs.getLong("id"),"date",rs.getDate("transaction_date").toLocalDate(),"item",rs.getString("item"),"quantity",rs.getString("quantity"),"rate",rs.getBigDecimal("rate"),"amount",rs.getBigDecimal("amount"),"balance",rs.getBigDecimal("balance")), customerId,from,from,to,to); }

  @PostMapping("/customers/{customerId}/transactions") @ResponseStatus(HttpStatus.CREATED)
  public TransactionRequest createTransaction(@RequestAttribute("ownerId") Long ownerId,@PathVariable Long customerId,@RequestBody TransactionRequest r){ verifyCustomer(ownerId,customerId); db.update("INSERT INTO transactions(customer_id,transaction_date,item,quantity,rate,amount,balance) VALUES(?,?,?,?,?,?,?)",customerId,Date.valueOf(r.date()),r.item(),r.quantity(),new BigDecimal(r.rate()),new BigDecimal(r.amount()),new BigDecimal(r.balance())); return r; }
  private void verifyOrganization(Long ownerId, Long id){ if(db.queryForObject("SELECT COUNT(*) FROM organizations WHERE id=? AND owner_id=?",Long.class,id,ownerId)==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Organization not found"); }
  private void verifyCustomer(Long ownerId, Long id){ if(db.queryForObject("SELECT COUNT(*) FROM customers c JOIN organizations o ON o.id=c.organization_id WHERE c.id=? AND o.owner_id=?",Long.class,id,ownerId)==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Customer not found"); }
  public record LoginRequest(String username,String password){} public record OrganizationRequest(String name,String address){} public record CustomerRequest(String name,String mobileNumber,String fatherName,String address){} public record TransactionRequest(String date,String item,String quantity,String rate,String amount,String balance){}
}