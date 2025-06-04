import React, {
  createContext,
  use,
  useCallback,
  useContext,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "../src/React";

type BasicData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};
type AddressData = {
  street: string;
  city: string;
  state: string;
  zip: string;
};
type PaymentData = {
  cardNumber: string;
  cardExpiry: string;
  cardCVC: string;
};
type UserFormContextType = {
  basicData: BasicData;
  addressData: AddressData;
  paymentData: PaymentData;
};

type Join<K, P> = K extends string
  ? P extends string
    ? `${K}.${P}`
    : never
  : never;

type RecursiveKeys<T> = {
  [K in keyof T]: T[K] extends object
    ? Join<K & string, keyof T[K] & string>
    : K & string;
}[keyof T];

type Key = RecursiveKeys<UserFormContextType>;

type Case = `update.${Key}`;

function formReducer(
  state: UserFormContextType,
  action: { type: Case; payload: string }
) {
  const keys = action.type.split(".").slice(1);
  let current = state;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current)) {
      throw new Error(`Invalid key: ${key}`);
    }
    current = current[key];
  }

  const lastKey = keys[keys.length - 1];

  if (!(lastKey in current)) {
    throw new Error(`Invalid key: ${lastKey}`);
  }

  return {
    ...state,
    [keys[0]]: {
      ...state[keys[0]],
      [lastKey]: action.payload,
    },
  };
}

type Page = keyof UserFormContextType;
const UserFormContext = createContext({
  formData: {} as UserFormContextType,
  dispatch: (_arg0: { type: Case; payload: string }) => {},
  currentPage: "basic" as Page,
  setCurrentPage: (_arg0: Page) => {},
  submit: () => {
    console.log("Form submitted");
  },
});

const pagenames: Record<Page, string> = {
  basicData: "Basic Information",
  addressData: "Address Information",
  paymentData: "Payment Information",
};

const FormMap = {
  basicData: BasicForm,
  addressData: AddressForm,
  paymentData: PaymentForm,
};

export function FullExample() {
  const [currentPage, setCurrentPage] = useState<Page>("basicData");
  const [formData, dispatch] = useReducer(formReducer, {
    basicData: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
    },
    addressData: {
      street: "",
      city: "",
      state: "",
      zip: "",
    },
    paymentData: {
      cardNumber: "",
      cardExpiry: "",
      cardCVC: "",
    },
  });

  const FormComponent = FormMap[currentPage];

  function submit() {
    console.log("Form submitted with data:", formData);
  }

  const value = useMemo(
    () => ({
      formData,
      dispatch,
      setCurrentPage,
      currentPage,
      submit,
    }),
    [formData, dispatch, setCurrentPage, currentPage]
  );

  return (
    <UserFormContext.Provider value={value}>
      <FormWrapper>
        <h1>{pagenames[currentPage]}</h1>
        <FormComponent />
      </FormWrapper>
    </UserFormContext.Provider>
  );
}

function FormWrapper(params) {
  return (
    <div
      style={{
        padding: "20px",
        border: "1px solid #ccc",
        borderRadius: "5px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <h2>Form Example</h2>
      {params.children}
    </div>
  );
}

function Input(props: { name: Key; label: string; type?: string }) {
  const { formData, dispatch } = useContext(UserFormContext);

  const handleChange = useCallback(
    (e) =>
      dispatch({
        type: `update.${props.name}`,
        payload: e.target.value,
      }),
    [dispatch, props.name]
  );

  const [mainKey, subKey] = props.name.split(".");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label htmlFor={props.name} style={{ margin: "5px 0" }}>
        {props.label}
      </label>
      <input
        id={props.name}
        type={props.type}
        key={props.name}
        value={formData[mainKey][subKey] || ""}
        onChange={handleChange}
        style={{
          padding: "10px 5px",
          borderRadius: "3px",
          border: "1px solid #ccc",
        }}
      />
    </div>
  );
}

const buttonStyle = {
  padding: "10px 20px",
  backgroundColor: "#007bff",
  color: "#fff",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
  marginTop: "10px",
  width: "100%",
};

function BasicForm() {
  const { setCurrentPage } = useContext(UserFormContext);

  return (
    <div>
      <Input name="basicData.firstName" label="First Name" type="text" />
      <Input name="basicData.lastName" label="Last Name" type="text" />
      <Input name="basicData.email" label="Email" type="email" />
      <Input name="basicData.phone" label="Phone" type="tel" />
      <button
        type="button"
        style={buttonStyle}
        onClick={() => setCurrentPage("addressData")}
      >
        Next: Address Information
      </button>
    </div>
  );
}

function AddressForm() {
  const { setCurrentPage } = useContext(UserFormContext);

  return (
    <div>
      <Input name="addressData.street" label="Street" type="text" />
      <Input name="addressData.city" label="City" type="text" />
      <Input name="addressData.state" label="State" type="text" />
      <Input name="addressData.zip" label="Zip Code" type="text" />
      <button
        type="button"
        style={buttonStyle}
        onClick={() => setCurrentPage("paymentData")}
      >
        Next: Payment Information
      </button>
    </div>
  );
}

function PaymentForm() {
  const { submit } = useContext(UserFormContext);
  const ref = useRef(null);

  function handleClick() {
    submit();
    ref.current.open();
  }

  return (
    <div>
      <UserDataModal ref={ref} />
      <Input name="paymentData.cardNumber" label="Card Number" type="text" />
      <Input name="paymentData.cardExpiry" label="Card Expiry" type="text" />
      <Input name="paymentData.cardCVC" label="Card CVC" type="text" />
      <button type="button" style={buttonStyle} onClick={handleClick}>
        Start Over
      </button>
    </div>
  );
}

function UserDataModal(props) {
  const [visible, setModalVisible] = useState(false);

  const { formData, setCurrentPage } = useContext(UserFormContext);

  useImperativeHandle(props.ref, () => ({
    open: () => setModalVisible(true),
    close: () => setModalVisible(false),
  }));

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        backgroundColor: "#fff",
        padding: "20px",
        borderRadius: "5px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
      }}
    >
      <h2>User Data</h2>
      <pre>{JSON.stringify(formData, null, 2)}</pre>
      <button
        type="button"
        onClick={() => {
          setModalVisible(false);
          setCurrentPage("basicData");
        }}
        style={buttonStyle}
      >
        Start Over
      </button>
    </div>
  );
}
