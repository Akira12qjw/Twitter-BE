import User from "~/models/schemas/User.schema";
import databaseService from "./database.services";
import { signToken } from "~/utils/jwt";
import { TokenType, UserVerifyStatus } from "~/constants/enums";
import { envConfig } from "~/constants/config";
import { hashPassword } from "~/utils/crypto";
import RefreshToken from "~/models/schemas/RefreshToken.schema";
import { ObjectId } from "mongodb";
import { RegisterReqBody } from "~/models/requests/User.requests";
import { config } from "dotenv";
import { USERS_MESSAGES } from "~/constants/messages";
config();
class UsersService {
  private signAccessToken(user_id: string) {
    return signToken({
      payload: {
        user_id,
        token_type: TokenType.AccessToken,
      },
      privateKey: process.env.JWT_SECRET_ACCESS_TOKEN as string,
      options: {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN,
      },
    });
  }
  private signRefreshToken(user_id: string) {
    return signToken({
      payload: {
        user_id,
        token_type: TokenType.RefreshToken,
      },
      privateKey: process.env.JWT_SECRET_REFRESH_TOKEN as string,
      options: {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
      },
    });
  }
  private signEmailVerifyToken(user_id: string) {
    return signToken({
      payload: {
        user_id,
        token_type: TokenType.EmailVerifyToken,
      },
      privateKey: process.env.JWT_SECRET_EMAIL_VERIFY_TOKEN as string,
      options: {
        expiresIn: process.env.EMAIL_VERIFY_TOKEN_EXPIRES_IN,
      },
    });
  }

  private signAccessAndRefreshToken(user_id: string) {
    return Promise.all([
      this.signAccessToken(user_id),
      this.signRefreshToken(user_id),
    ]);
  }

  async register(payload: RegisterReqBody) {
    const user_id = new ObjectId();
    const email_verify_token = await this.signEmailVerifyToken(
      user_id.toString()
    );
    await databaseService.users.insertOne(
      new User({
        ...payload,
        _id: user_id,
        email_verify_token,
        date_of_birth: new Date(payload.date_of_birth),
        password: hashPassword(payload.password),
      })
    );
    const [access_token, refresh_token] = await this.signAccessAndRefreshToken(
      user_id.toString()
    );
    await databaseService.refresh_token.insertOne(
      new RefreshToken({ user_id: new ObjectId(user_id), token: refresh_token })
    );
    console.log(" email_verify_token: ", email_verify_token);
    return {
      access_token,
      refresh_token,
    };
  }

  async checkEmailExists(email: string) {
    const user = await databaseService.users.findOne({ email });
    return Boolean(user);
  }

  async login(user_id: string) {
    const [access_token, refresh_token] =
      await this.signAccessAndRefreshToken(user_id);
    await databaseService.refresh_token.insertOne(
      new RefreshToken({ user_id: new ObjectId(user_id), token: refresh_token })
    );
    return {
      access_token,
      refresh_token,
    };
  }
  async logout(refresh_token: string) {
    await databaseService.refresh_token.deleteOne({ token: refresh_token });
    return {
      message: USERS_MESSAGES.LOGOUT_SUCCESS,
    };
  }

  async verifyEmail(user_id: string) {
    const [token] = await Promise.all([
      this.signAccessAndRefreshToken(user_id),
      await databaseService.users.updateOne(
        {
          _id: new ObjectId(user_id),
        },
        {
          $set: {
            email_verify_token: "",
            verify: UserVerifyStatus.Verified,
            updated_at: new Date(),
          },
        }
      ),
    ]);
    const [access_token, refresh_token] = token;
    return {
      access_token,
      refresh_token,
    };
  }
}
const usersService = new UsersService();
export default usersService;
